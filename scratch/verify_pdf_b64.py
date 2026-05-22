import base64
import os

filepath = r'd:\Abel paginas\Aquatech\Crm Aquatech\src\lib\pdf-generator.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract B64
try:
    start = content.find("const AQUATECH_LOGO_B64 = '") + len("const AQUATECH_LOGO_B64 = '")
    end = content.find("';", start)
    b64_str = content[start:end]
    
    if b64_str.startswith('data:image'):
        b64_data = b64_str.split(',')[1]
    else:
        b64_data = b64_str
        
    img_data = base64.b64decode(b64_data)
    print(f"B64 Length: {len(b64_str)}")
    print(f"Decoded data size: {len(img_data)} bytes")
except Exception as e:
    print(f"Error: {e}")
