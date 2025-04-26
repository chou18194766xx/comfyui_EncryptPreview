# -*- coding: utf-8 -*-
import torch
import numpy as np
import logging
from PIL import Image
import io
import base64

# 设置日志记录器
logger = logging.getLogger(__name__)
# 可以根据需要调整日志级别，INFO 或 WARNING 通常足够
logger.setLevel(logging.WARNING) # 设置为 WARNING，减少不必要的日志输出

# 定义日志前缀
LOG_PREFIX = "[EncryptPreviewImage]"

class EncryptPreviewImage:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE", {"tooltip": "The images to preview without saving."}),
            },
            "hidden": { # 隐藏输入在某些场景下可能有用
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "preview_image"
    OUTPUT_NODE = True
    CATEGORY = "image/preview" # 归类到 image/preview 下方便查找

    def preview_image(self, images, prompt=None, extra_pnginfo=None):
        if images is None:
            # logger.warning(f"{LOG_PREFIX} Input images is None.") # 可以取消注释以调试 None 输入
            return {}

        if not isinstance(images, torch.Tensor):
            logger.error(f"{LOG_PREFIX} Input type is not torch.Tensor: {type(images)}")
            return {}

        # logger.info(f"{LOG_PREFIX} Received {images.shape[0]} image(s) with shape {images.shape}") # 可以取消注释调试输入形状

        base64_previews = []
        try:
            for i in range(images.shape[0]):
                img_tensor = images[i].cpu()
                img_np = np.clip(255. * img_tensor.numpy(), 0, 255).astype(np.uint8)
                pil_image = Image.fromarray(img_np)
                buffer = io.BytesIO()

                # 使用较快的 PNG 压缩级别进行预览
                pil_image.save(buffer, format="PNG", compress_level=1)
                buffer.seek(0)
                img_bytes = buffer.getvalue()
                base64_encoded = base64.b64encode(img_bytes).decode('utf-8')
                base64_previews.append(base64_encoded)

            # logger.info(f"{LOG_PREFIX} Successfully encoded {len(base64_previews)} images to Base64 PNG.") # 可以取消注释调试编码成功

        except Exception as e:
            # 保留错误日志，这对于定位问题很重要
            logger.error(f"{LOG_PREFIX} Error encoding image: {e}", exc_info=True)
            # 即使出错，也可能返回部分成功编码的图像
            # 或者可以选择返回空 {} 表示失败

        # 返回包含 Base64 数据的字典给 UI
        return {"ui": {"encrypted_previews": base64_previews}}