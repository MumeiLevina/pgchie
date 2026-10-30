"""Create a real synthetic MP3 test signal OUTSIDE the website; never ship audio fixtures.
Dev prerequisite: python -m pip install imageio-ffmpeg
"""
import math
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
import imageio_ffmpeg

target = Path(tempfile.gettempdir()) / 'chie-audio-test'
target.mkdir(exist_ok=True)
with wave.open(str(target / 'signal.wav'), 'wb') as out:
    out.setparams((1, 2, 22050, 0, 'NONE', 'not compressed'))
    out.writeframes(b''.join(struct.pack('<h', int(7000 * math.sin(2 * math.pi * 440 * n / 22050))) for n in range(22050 * 8)))
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(target / 'signal.wav'), str(target / 'signal.mp3')], check=True)
print(target / 'signal.mp3')
