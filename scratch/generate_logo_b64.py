import base64
import os

img_path = r'd:\Abel paginas\Aquatech\Crm Aquatech\public\logo.jpg'
if os.path.exists(img_path):
    with open(img_path, 'rb') as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        # Use JPEG header
        full_b64 = f"data:image/jpeg;base64,{encoded_string}"
        # Write to a temp file to read it late
        with open('scratch/logo_b64.txt', 'w') as out:
            out.write(full_b64)
        print(f"B64 generated. Total chars: {len(full_b64)}")
else:
    print("Logo not found at public/logo.jpg")
