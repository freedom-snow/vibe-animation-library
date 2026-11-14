# three-render-pipeline 一键渲染（Windows PowerShell 包装器）
$ErrorActionPreference = "Stop"

# REMOTION_CHROME_PATH 指向 chrome-headless-shell 所在目录；
# 未设置时脚本会尝试从系统 PATH 中寻找 chrome-headless-shell。
if (-not $env:REMOTION_CHROME_PATH) {
  Write-Host "提示：未设置 REMOTION_CHROME_PATH，将尝试从 PATH 查找 chrome-headless-shell"
}

# 切到脚本所在目录，保证相对路径正确
Set-Location $PSScriptRoot

# 可选环境变量：
#   $env:RENDER_GL     = 'gpu' 走硬件加速；缺省为 swiftshader 软件渲染
#   $env:CAPTURE       = 'jpeg' 提速取图；缺省为 png
#   $env:THREE_DIR     = 自定义 three 模块目录（缺省 node_modules/three）
#   $env:FFMPEG_PATH    = 自定义 ffmpeg 路径
node render.mjs
exit $LASTEXITCODE
