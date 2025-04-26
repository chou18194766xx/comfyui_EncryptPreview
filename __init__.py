# -*- coding: utf-8 -*-
import sys
import os
import logging

# 将当前目录添加到 sys.path
current_path = os.path.dirname(os.path.realpath(__file__))
if current_path not in sys.path:
    sys.path.append(current_path)

# 导入核心节点类
from .encrypt_preview import EncryptPreviewImage

# 节点类映射
NODE_CLASS_MAPPINGS = {
    "EncryptPreviewImage": EncryptPreviewImage
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "EncryptPreviewImage": "Encrypt Preview Image (No File)"
}

# 定义 WEB_DIRECTORY 指向 JS 文件目录
WEB_DIRECTORY = "js"

# 确认加载日志 (保留，有助于确认插件是否加载)
print("------------------------------------------")
print("# [ComfyUI_EncryptPreview] Loaded")
logging.info("[ComfyUI_EncryptPreview] Custom Node loaded successfully.")
print("------------------------------------------")

# 导出映射和 Web 目录
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']