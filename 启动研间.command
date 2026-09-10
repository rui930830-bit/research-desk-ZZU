#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if [[ -x /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 ]]; then
  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 launch.py
else
  python3 launch.py
fi
