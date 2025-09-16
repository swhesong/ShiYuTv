import json
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import logging
import argparse
import sys

# logger实例在全局获取，但配置在main函数中进行
logger = logging.getLogger(__name__)


def base58_encode(data_str):
    """Base58编码实现"""
    ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    bytes_data = data_str.encode('utf-8')

    if len(bytes_data) == 0:
        return ''

    # 将字节数组转换为大整数
    num = int.from_bytes(bytes_data, 'big')

    if num == 0:
        return ALPHABET[0]

    result = ''
    while num > 0:
        result = ALPHABET[num % 58] + result
        num = num // 58

    # 处理前导零
    for byte in bytes_data:
        if byte == 0:
            result = ALPHABET[0] + result
        else:
            break

    return result

def setup_logging(debug=False):
    """配置日志记录器"""
    # 如果开启debug模式，日志级别为DEBUG，否则为INFO
    log_level = logging.DEBUG if debug else logging.INFO

    # 获取根日志记录器并设置级别
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # 清除任何可能已经存在的处理器，避免重复输出
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # 创建格式化器
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    # 创建控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 如果开启debug模式，则额外添加文件处理器
    if debug:
        try:
            # 创建文件处理器，每次运行时覆盖旧的日志文件
            file_handler = logging.FileHandler("logs.txt", mode='w', encoding='utf-8')
            file_handler.setLevel(logging.DEBUG)  # 文件日志始终记录最详细的DEBUG级别
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
            logger.info("Debug模式已开启，详细日志将记录到 logs.txt 文件中。")
        except Exception as e:
            logger.error(f"无法创建日志文件 logs.txt: {e}")


class VideoSourceProcessor:
    def __init__(self):
        self.lock = Lock()
        self.processed_urls = set()

    def extract_actual_url(self, url):
        """提取实际链接，将包含provide/vod的链接转换为provide/vod结尾的链接"""
        if not url or not isinstance(url, str):
            # 因为输入无效，这里不记录日志，避免日志泛滥
            return None

        original_url_for_logging = url  # 保留原始URL用于日志记录

        # 清理URL，移除引号和多余空格
        url = url.strip().strip('"').strip("'").rstrip('?').rstrip('/')

        # 检查是否包含provide/vod
        if 'provide/vod' not in url:
            logger.debug(f"提取失败: URL不包含 'provide/vod'。原始URL: '{original_url_for_logging}'")
            return None

        # 找到provide/vod的位置并截取到其后
        provide_index = url.find('provide/vod')
        if provide_index == -1:
            # 这个分支理论上不会进入，因为上面已经检查过了
            return None

        # 截取到provide/vod结尾
        actual_url = url[:provide_index + len('provide/vod')]

        # 处理代理URL的情况
        if 'proxy/' in actual_url:
            # 提取代理后面的真实URL
            proxy_parts = actual_url.split('proxy/')
            if len(proxy_parts) > 1:
                real_url = proxy_parts[1]
                if 'provide/vod' in real_url:
                    provide_index = real_url.find('provide/vod')
                    actual_url = real_url[:provide_index + len('provide/vod')]

        # 确保URL格式正确
        if not actual_url.startswith(('http://', 'https://')):
            logger.debug(f"提取失败: URL格式不正确 (非http/https开头)。处理后URL: '{actual_url}'，原始URL: '{original_url_for_logging}'")
            return None

        # 新增：检查和过滤无效URL格式
        if self._is_invalid_url_format(actual_url):
            logger.debug(f"提取失败: URL格式无效。URL: '{actual_url}'，原始URL: '{original_url_for_logging}'")
            return None

        logger.debug(f"提取成功: 从 '{original_url_for_logging}' 提取到 '{actual_url}'")
        return actual_url

    def _is_invalid_url_format(self, url):
        """检查URL是否是无效格式"""
        # 检查重复协议：http://http:// 、 https://https:// 、 http://https:// 、 https://http://
        double_protocol_patterns = [
            'http://http://',
            'https://https://',
            'http://https://',
            'https://http://'
        ]

        for pattern in double_protocol_patterns:
            if pattern in url.lower():
                return True

        # 检查是否包含中文字符
        if re.search(r'[\u4e00-\u9fff]', url):
            return True

        # 检查是否包含带有中文的括号或其他特殊字符
        if re.search(r'[（）\u4e00-\u9fff]', url):
            return True

        # 检查是否包含不合适的特殊字符，如反引号
        if re.search(r'[`\uFEFF]', url):
            return True

        return False
    def extract_domain_name(self, url):
        """从URL中提取合适的名称"""
        try:
            parsed = urllib.parse.urlparse(url)
            domain_parts = parsed.netloc.split('.')

            # 移除www前缀
            if domain_parts[0] == 'www':
                domain_parts = domain_parts[1:]

            # 如果第一段是api等通用词，使用第二段
            generic_prefixes = ['api', 'www', 'data', 'cdn', 'static', 'media']
            if len(domain_parts) >= 2 and domain_parts[0].lower() in generic_prefixes:
                return domain_parts[1]
            else:
                return domain_parts[0]
        except:
            return "未知资源"

    def parse_file_content(self, content, file_type="unknown"):
        """解析文件内容，提取名称和实际链接"""
        # 修改点：初始化两个列表，用于存放有效和无效数据
        valid_results = []
        invalid_results = [] # 虽然当前逻辑不会填充它，但为了结构完整性保留

        # 首先尝试完整JSON解析
        try:
            if content.strip().startswith('{') or content.strip().startswith('['):
                data = json.loads(content)
                # _parse_json_data 内部只会返回有效的，所以直接extend
                valid_results.extend(self._parse_json_data(data))
                logger.info(f"成功解析完整JSON格式，提取到 {len(valid_results)} 条数据")
                # 修改点：返回两个列表
                return valid_results, invalid_results
        except json.JSONDecodeError:
            logger.info("完整JSON解析失败，尝试片段解析")

        # 使用改进的片段解析
        # _parse_content_fragments 内部也只返回有效的
        valid_results.extend(self._parse_content_fragments(content))
        logger.info(f"片段解析完成，提取到 {len(valid_results)} 条数据")

        # 修改点：返回两个列表
        return valid_results, invalid_results


    def _parse_content_fragments(self, content):
        """解析内容片段，处理不规范的JSON和文本混合内容"""
        results = []
        # # 新增：处理简单的逗号分隔格式
        # lines = content.strip().split('\n')
        # for line in lines:
        #     line = line.strip()
        #     if ',' in line:
        #         parts = line.split(',', 1)  # 只分割第一个逗号
        #         if len(parts) == 2:
        #             name = parts[0].strip()
        #             url = parts[1].strip()
        #             actual_url = self.extract_actual_url(url)
        #             if actual_url:
        #                 results.append((name, actual_url))
        #                 continue
        #
        # # 如果简单解析成功，直接返回
        # if results:
        #     return results
        # 使用正则表达式找到所有可能的资源定义
        patterns = [
            # 标准JSON对象模式：包含name/key和api/base_url
            r'\{\s*"(?:key|name)"\s*:\s*"([^"]+)"\s*,[\s\S]*?"(?:api|base_url)"\s*:\s*"([^"]+)"[\s\S]*?\}',
            # 简化模式：只匹配相邻的name和api字段
            r'"(?:name|key)"\s*:\s*"([^"]+)"[^}]*?"(?:api|base_url)"\s*:\s*"([^"]+)"',
            # 反向模式：api在前，name在后
            r'"(?:api|base_url)"\s*:\s*"([^"]+)"[^}]*?"(?:name|key)"\s*:\s*"([^"]+)"',
        ]

        for i, pattern in enumerate(patterns, 1):
            matches = re.findall(pattern, content, re.MULTILINE | re.DOTALL)
            logger.debug(f"正则模式 {i} 匹配到 {len(matches)} 个潜在结果。")
            for match in matches:
                if len(match) == 2:
                    # 判断哪个是名称，哪个是URL
                    if self.extract_actual_url(match[1]):
                        name, url = match[0], match[1]
                    elif self.extract_actual_url(match[0]):
                        name, url = match[1], match[0]
                    else:
                        logger.debug(f"正则匹配丢弃: 匹配项 '{match}' 中的两个元素均不是有效的 provide/vod 链接。")
                        continue

                    actual_url = self.extract_actual_url(url)
                    if actual_url:
                        results.append((name.strip(), actual_url))

        logger.info(f"所有正则模式执行完毕，共找到 {len(results)} 条结果。")

        # 如果上述方法没有找到足够的结果，使用行解析
        logger.info(f"正则查找找到 {len(results)} 条结果，将继续执行行解析模式以确保完整性...")
        line_results = self._parse_lines_with_context(content.split('\n'))
        results.extend(line_results)
        logger.info(f"行解析模式完成，新增 {len(line_results)} 条结果。")

        return results


    def _parse_lines_with_context(self, lines):
        """解析文本行，考虑上下文关联"""
        results = []
        pending_names = []  # 存储待匹配的名称

        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue

            # 查找URL
            url_pattern = r'https?://[^\s\'"<>,]+'
            urls = re.findall(url_pattern, line)

            if not urls:
                logger.debug(f"行解析: 第 {line_num} 行未找到任何 http/https URL。行内容: '{line[:100]}'")
                # 注意：即使没有URL，也要继续执行，以便提取潜在的名称

            found_valid_url = False
            for url in urls:
                # extract_actual_url 内部会记录详细的失败日志，这里我们只需知道它成功与否
                actual_url = self.extract_actual_url(url)
                if actual_url:
                    found_valid_url = True


                    # 尝试从当前行获取名称
                    name = self._extract_name_from_line(line, url)

                    # 如果当前行没有好的名称，尝试使用之前存储的名称
                    if (not name or name == "未知资源") and pending_names:
                        name = pending_names.pop(0)

                    # 如果还是没有名称，尝试向前查找
                    if not name or name == "未知资源":
                        name = self._find_contextual_name(lines, line_num - 1, url)

                    # 最后回退到域名提取
                    if not name:
                        name = self.extract_domain_name(actual_url)

                    results.append((name, actual_url))

            # 如果本行没有找到有效URL，但可能包含名称
            if not found_valid_url:
                potential_names = self._extract_potential_names_from_line(line)
                pending_names.extend(potential_names)

        return results

    def _extract_potential_names_from_line(self, line):
        """从行中提取所有可能的名称"""
        names = []

        # 匹配name字段
        name_matches = re.findall(r'"(?:name|key)"\s*:\s*"([^"]+)"', line)
        names.extend(name_matches)

        # 匹配引号中的中文或有意义的英文
        quoted_matches = re.findall(r'"([^"]*(?:[\u4e00-\u9fff]|资源|影视|视频|电影|TV)[^"]*)"', line)
        for match in quoted_matches:
            if len(match) > 1 and not match.startswith('http'):
                names.append(match)

        # 匹配纯中文词组
        chinese_matches = re.findall(r'[\u4e00-\u9fff]{2,}(?:资源|影视|视频|电影|TV)?', line)
        names.extend(chinese_matches)

        return [name.strip() for name in names if name.strip()]

    def _find_contextual_name(self, lines, current_index, url):
        """在上下文中查找名称"""
        search_range = 5  # 向前向后搜索的行数

        # 向前查找
        for i in range(max(0, current_index - search_range), current_index):
            if i < 0 or i >= len(lines):
                continue
            line = lines[i].strip()
            if not line:
                continue

            names = self._extract_potential_names_from_line(line)
            if names:
                return names[0]  # 返回第一个找到的名称

        # 向后查找
        for i in range(current_index + 1, min(len(lines), current_index + search_range)):
            if i >= len(lines):
                break
            line = lines[i].strip()
            if not line:
                continue

            names = self._extract_potential_names_from_line(line)
            if names:
                return names[0]

        return None

    def _parse_json_data(self, data, parent_key=""):
        """递归解析JSON数据"""
        results = []

        if isinstance(data, dict):
            # 首先检查当前字典是否本身就是一个资源对象
            if self._is_source_object(data):
                name, url = self._extract_from_source_object(data)
                if name and url:
                    results.append((name, url))
                    return results

            # 遍历字典的键值对
            for key, value in data.items():
                if isinstance(value, str):
                    actual_url = self.extract_actual_url(value)
                    if actual_url:
                        # 尝试从同一字典中获取对应的名称
                        name = self._extract_name_from_json(data, key, parent_key)
                        results.append((name, actual_url))
                elif isinstance(value, dict):
                    # 递归处理嵌套字典
                    results.extend(self._parse_json_data(value, key))
                elif isinstance(value, list):
                    # 处理数组
                    for item in value:
                        if isinstance(item, dict):
                            # 检查数组元素是否是资源对象
                            if self._is_source_object(item):
                                name, url = self._extract_from_source_object(item)
                                if name and url:
                                    results.append((name, url))
                            else:
                                results.extend(self._parse_json_data(item, key))
                        else:
                            results.extend(self._parse_json_data(item, key))

        elif isinstance(data, list):
            for item in data:
                results.extend(self._parse_json_data(item, parent_key))

        return results

    def _is_source_object(self, obj):
        """检查对象是否是资源对象"""
        if not isinstance(obj, dict):
            return False

        # 检查常见的URL字段
        url_fields = ['url', 'api', 'base_url', 'link']
        has_url = False

        for field in url_fields:
            if field in obj and isinstance(obj[field], str):
                # 检查是否是有效的provide/vod链接
                if self.extract_actual_url(obj[field]):
                    has_url = True
                    break

        # 如果有有效的URL，并且有name或key字段，则认为是资源对象
        if has_url and ('name' in obj or 'key' in obj):
            return True

        return False

    def _extract_from_source_object(self, obj):
        """从资源对象中提取名称和URL"""
        url_fields = ['api', 'base_url', 'url', 'link']
        url = None

        # 按优先级查找URL字段
        for field in url_fields:
            if field in obj and isinstance(obj[field], str):
                url = self.extract_actual_url(obj[field])
                if url:
                    break

        if not url:
            return None, None

        # 获取名称，优先使用name字段，其次是key字段
        name = obj.get('name', obj.get('key', ''))

        # 如果没有名称，从URL中提取
        if not name:
            name = self.extract_domain_name(url)

        return name.strip(), url

    def _extract_name_from_json(self, data, current_key, parent_key):
        """从JSON数据中提取名称"""
        # 首先查找name字段
        if 'name' in data and isinstance(data['name'], str):
            return data['name'].strip()

        # 查找key字段
        if 'key' in data and isinstance(data['key'], str):
            return data['key'].strip()

        # 使用父级key或当前key作为名称
        if parent_key and parent_key != current_key:
            return parent_key
        elif current_key:
            return current_key

        return "未知资源"

    def _extract_name_from_line(self, line, url):
        """从文本行中提取名称"""
        # 移除URL，看剩下的内容是否可以作为名称
        line_without_url = line.replace(url, '').strip()

        # 优先查找JSON字段中的名称
        names = self._extract_potential_names_from_line(line)
        if names:
            return names[0]

        # 如果没有找到合适的名称，从URL中提取
        return self.extract_domain_name(url)

    def remove_duplicates(self, data):
        """去除重复项，保留第一个出现的"""
        seen_urls = set()
        unique_data = []
        duplicate_data = []  # 新增：用于存储被删除的重复项

        for name, url in data:
            if url not in seen_urls:
                seen_urls.add(url)
                unique_data.append((name, url))
            else:
                # 新增：如果URL已存在，则将其添加到重复数据列表中
                duplicate_data.append((name, url))

        return unique_data, duplicate_data # <--- 修正点：现在返回两个值


    def compare_and_filter(self, file1_data, file2_data):
        """比较两个文件的数据，移除file1中在file2中存在的链接"""
        file2_urls = {url for _, url in file2_data}
        filtered_data = []

        for name, url in file1_data:
            if url not in file2_urls:
                filtered_data.append((name, url))

        return filtered_data

    def generate_json_output(self, data):
        """生成JSON格式输出"""
        # 修改点：创建api_site字典来存放资源
        api_site_data = {}

        for i, (name, url) in enumerate(data, 1):
            api_key = f"api_{i}"

            # 提取detail URL (域名部分)
            try:
                parsed = urllib.parse.urlparse(url)
                detail_url = f"{parsed.scheme}://{parsed.netloc}"
            except:
                detail_url = url

            api_site_data[api_key] = {
                "name": name,
                "api": url,
                "detail": detail_url
            }

        # 修改点：构建最终的、符合附件格式的完整结构
        final_json_structure = {
            "cache_time": 9200,  # 使用一个默认值，与示例文件保持一致
            "api_site": api_site_data
        }

        return final_json_structure

    def print_data_details(self, title, data, max_items=20):
        """打印数据详情，支持限制显示数量"""
        print(f"\n{'=' * 50}")
        print(f"{title}")
        print(f"{'=' * 50}")

        if not data:
            print("无数据")
            return

        print(f"总计: {len(data)} 条数据")

        # 显示前N条数据
        display_count = min(len(data), max_items)
        print(f"显示前 {display_count} 条:")
        print("-" * 50)

        for i, (name, url) in enumerate(data[:display_count], 1):
            print(f"{i:2d}. 名称: {name}")
            print(f"    链接: {url}")
            print()

        # 如果数据太多，提示省略的数量
        if len(data) > max_items:
            print(f"... (省略了 {len(data) - max_items} 条数据)")

        print("-" * 50)

    def process_file(self, file_path, file_type="unknown"):
        """处理单个文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            logger.info(f"正在处理文件: {file_path}")
            # 修改点：现在接收两个返回值
            valid_data, invalid_data = self.parse_file_content(content, file_type)
            logger.info(f"从 {file_path} 中提取到 {len(valid_data)} 条有效数据")

            # 修改点：返回两个列表
            return valid_data, invalid_data
        except Exception as e:
            logger.error(f"处理文件 {file_path} 时出错: {str(e)}")
            # 修改点：出错时也返回两个空列表
            return [], []


    def process_files_parallel(self, file_paths):
        """并行处理多个文件"""
        all_results = []

        with ThreadPoolExecutor(max_workers=4) as executor:
            future_to_file = {executor.submit(self.process_file, file_path): file_path
                              for file_path in file_paths}

            for future in as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    result = future.result()
                    all_results.extend(result)
                except Exception as e:
                    logger.error(f"处理文件 {file_path} 时出错: {str(e)}")

        return all_results

    def save_results(self, data, output_file, format_type="json"):
        """保存结果"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                if format_type == "json":
                    json.dump(data, f, ensure_ascii=False, indent=4)
                else:
                    for name, url in data:
                        f.write(f"{name} {url}\n")

            logger.info(f"结果已保存到: {output_file}")
        except Exception as e:
            logger.error(f"保存文件时出错: {str(e)}")

    def save_base58_encoded_results(self, data, output_file):
        """保存Base58编码的JSON结果"""
        try:
            # 先生成JSON字符串
            json_str = json.dumps(data, ensure_ascii=False, separators=(',', ':'))

            # 进行Base58编码
            encoded_data = base58_encode(json_str)

            # 保存编码后的字符串
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(encoded_data)

            logger.info(f"Base58编码结果已保存到: {output_file}")
        except Exception as e:
            logger.error(f"保存Base58编码文件时出错: {str(e)}")

def main():
    # --- 新增：命令行参数解析 ---
    parser = argparse.ArgumentParser(description="视频源处理和比较工具")
    parser.add_argument(
        '--debug',
        action='store_true',
        help="开启Debug模式，将在控制台输出详细日志并生成 logs.txt 文件。"
    )
    args = parser.parse_args()

    # --- 新增：根据参数配置日志 ---
    setup_logging(debug=args.debug)

    # --- 原有代码开始 ---
    processor = VideoSourceProcessor()

    # 处理文件1和文件2
    logger.info("开始处理文件...")


    file1_valid_data, file1_invalid_data = processor.process_file("shipinywan.txt", "file1")
    file2_valid_data, file2_invalid_data = processor.process_file("basic.json", "file2")

    logger.info(f"文件1有效数据: {len(file1_valid_data)} 条，无效数据: {len(file1_invalid_data)} 条")
    logger.info(f"文件2有效数据: {len(file2_valid_data)} 条，无效数据: {len(file2_invalid_data)} 条")

    # 打印文件1原始有效数据
    processor.print_data_details("文件1原始有效数据 (shipinywan.txt)", file1_valid_data)

    # 打印文件1无效数据
    processor.print_data_details("文件1无效链接数据 (shipinywan.txt)", file1_invalid_data)

    # 打印文件2原始有效数据
    processor.print_data_details("文件2原始有效数据 (basic.json)", file2_valid_data)

    # 打印文件2无效数据
    processor.print_data_details("文件2无效链接数据 (basic.json)", file2_invalid_data)

    # 去重
    logger.info("正在去重...")
    file1_unique_data, file1_duplicate_data = processor.remove_duplicates(file1_valid_data)
    file2_unique_data, file2_duplicate_data = processor.remove_duplicates(file2_valid_data)

    logger.info(f"文件1去重后: {len(file1_unique_data)} 条，删除重复: {len(file1_duplicate_data)} 条")
    logger.info(f"文件2去重后: {len(file2_unique_data)} 条，删除重复: {len(file2_duplicate_data)} 条")

    # 打印文件1删除的重复数据
    processor.print_data_details("文件1删除的重复数据 (shipinywan.txt)", file1_duplicate_data)

    # 打印文件2删除的重复数据
    processor.print_data_details("文件2删除的重复数据 (basic.json)", file2_duplicate_data)

    # 比较并过滤，得到文件1中的新增数据
    logger.info("正在比较和过滤...")
    filtered_data = processor.compare_and_filter(file1_unique_data, file2_unique_data)

    logger.info(f"过滤后剩余 (文件1中的新增数据): {len(filtered_data)} 条")

    # 打印最终输出数据 (仅新增部分)
    processor.print_data_details("最终输出数据 (仅文件1新增部分)", filtered_data)

    # ====================================================================
    # 步骤1: 保存仅包含新增内容的结果
    # ====================================================================
    # 保存文本格式结果 (仅新增)
    processor.save_results(filtered_data, "filtered_results.txt", "text")

    # 生成JSON格式 (仅新增)
    logger.info("正在生成仅包含新增数据的JSON...")
    json_output_new_only = processor.generate_json_output(filtered_data)

    # 保存JSON结果 (仅新增)
    processor.save_results(json_output_new_only, "video_sources.json", "json")


    # ====================================================================
    # 新增步骤 2: 合并文件2的全部内容和文件1的新增内容，并保存
    # ====================================================================
    logger.info("正在合并数据以生成最终汇总文件...")
    # 将文件2的唯一数据与文件1过滤后的新增数据合并
    combined_data = file2_unique_data + filtered_data
    logger.info(f"汇总数据总计: {len(combined_data)} 条 (文件2: {len(file2_unique_data)} + 文件1新增: {len(filtered_data)})")

    # 打印汇总数据详情
    processor.print_data_details("汇总数据预览 (文件2 + 文件1新增)", combined_data)

    # 为合并后的数据生成JSON格式
    logger.info("正在生成汇总JSON格式...")
    json_output_combined = processor.generate_json_output(combined_data)

    # 保存最终的汇总JSON结果
    processor.save_results(json_output_combined, "combined_sources.json", "json")

    # 生成Base58编码的汇总文件
    logger.info("正在生成Base58编码的汇总文件...")
    processor.save_base58_encoded_results(json_output_combined, "combined_sources_base58.txt")

    logger.info("处理完成！")


    # ====================================================================
    # 修改后的详细统计信息
    # ====================================================================
    print(f"\n{'=' * 60}")
    print("详细处理结果统计")
    print(f"{'=' * 60}")
    print(f"文件1 (shipinywan.txt):")
    print(f"  - 原始有效数据: {len(file1_valid_data)} 条")
    print(f"  - 去重后数据:   {len(file1_unique_data)} 条")
    print(f"  - 与文件2比较后新增: {len(filtered_data)} 条")
    print()
    print(f"文件2 (basic.json):")
    print(f"  - 原始有效数据: {len(file2_valid_data)} 条")
    print(f"  - 去重后数据:   {len(file2_unique_data)} 条")
    print()
    print("--- 输出文件详情 ---")
    print(f"仅新增数据:")
    print(f"  - 内容: {len(filtered_data)} 条 (来自 shipinywan.txt)")
    print(f"  - 文件: video_sources.json, filtered_results.txt")
    print()
    print(f"汇总数据:")
    print(f"  - 内容: {len(combined_data)} 条 (basic.json + 新增)")
    print(f"  - 文件: combined_sources.json, combined_sources_base58.txt")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
