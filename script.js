// 使用 IIFE 避免污染全局作用域
(function () {
    // --- DOM Element References ---
    const urlInput = document.getElementById("urlInput");
    const parseBtn = document.getElementById("parseBtn");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const errorMessage = document.getElementById("errorMessage");
    // const paramsDisplay = { // Removed as the display section is gone
    //   qdbh: document.getElementById("qdbhParam"),
    //   sdbh: document.getElementById("sdbhParam"),
    //   sdsin: document.getElementById("sdsinParam"),
    // };
    const fileListContainer = document.getElementById("fileList");
    const downloadAllBtn = document.getElementById("downloadAllBtn");
    const downloadStatus = document.getElementById("downloadStatus");

    // --- State ---
    let fileListData = []; // 存储从 API 获取的文件信息

    // --- Constants ---
    const API_ENDPOINT =
        "https://zxfw.court.gov.cn/yzw/yzw-zxfw-sdfw/api/v1/sdfw/getWsListBySdbhNew";

    // --- Framer Motion (Basic Example) ---
    // 由于 CDN 引入，我们可以在 HTML 中使用 motion 属性，
    // 或者用 JS 简单控制样式变化配合 CSS transition
    const motion = window.motion; // 获取全局 motion 对象

    // --- Helper Functions ---

    /**
     * 显示加载状态
     * @param {boolean} isLoading - 是否显示加载
     */
    function setLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove("hidden");
            parseBtn.disabled = true;
            parseBtn.classList.add("opacity-50", "cursor-not-allowed");
        } else {
            loadingIndicator.classList.add("hidden");
            parseBtn.disabled = false;
            parseBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }

    /**
     * 显示错误信息
     * @param {string|null} message - 错误消息，null 则隐藏
     */
    function setError(message) {
        if (message) {
            errorMessage.textContent = message;
            errorMessage.classList.remove("hidden");
        } else {
            errorMessage.classList.add("hidden");
            errorMessage.textContent = "";
        }
    }

    /**
     * 从短信内容中提取 URL 并解析参数
     * @param {string} smsContent - 输入的短信内容字符串
     * @returns {object|null} - 包含 qdbh, sdbh, sdsin 的对象，或 null 如果解析失败
     */
    function extractUrlAndParamsFromSms(smsContent) {
        // 尝试匹配常见的 URL 格式 (包括 http 和 https)
        const urlRegex = /https?:\/\/[^\s]+/g;
        const matches = smsContent.match(urlRegex);

        if (!matches || matches.length === 0) {
            setError("未在输入内容中找到有效的 URL 链接");
            return null;
        }

        // 假设短信中第一个匹配到的 URL 是目标 URL
        const urlString = matches[0];
        console.log("提取到的 URL:", urlString); // 调试输出

        try {
            const url = new URL(urlString);
            let params;
            // 参数可能在 hash 中，也可能在 search 中
            if (url.hash.includes("?")) {
                // #/pagesAjkj/app/wssd/index?qdbh=...
                const hashQuery = url.hash.substring(url.hash.indexOf("?") + 1);
                params = new URLSearchParams(hashQuery);
            } else {
                params = url.searchParams;
            }

            const qdbh = params.get("qdbh");
            const sdbh = params.get("sdbh");
            const sdsin = params.get("sdsin");

            if (qdbh && sdbh && sdsin) {
                return { qdbh, sdbh, sdsin };
            } else {
                setError("从提取到的 URL 中未能解析出必要的参数 (qdbh, sdbh, sdsin)");
                return null;
            }
        } catch (error) {
            console.error("提取到的 URL 解析失败:", error);
            setError(`提取到的 URL (${urlString}) 格式无效或解析失败`);
            return null;
        }
    }

    // /**
    //  * 更新参数显示区域 (已移除)
    //  * @param {object|null} params - 参数对象或 null
    //  */
    // function updateParamsDisplay(params) {
    //   // ... (代码已删除)
    // }

    /**
     * 调用 API 获取文件列表
     * @param {object} params - 包含 qdbh, sdbh, sdsin 的对象
     * @returns {Promise<Array>} - 文件列表数组
     */
    async function fetchFileList(params) {
        setError(null); // 清除旧错误
        setLoading(true);
        downloadStatus.textContent = ""; // 清除下载状态

        try {
            // !! CORS 警告 !!
            // 直接从浏览器前端发送跨域 POST 请求到 zxfw.court.gov.cn
            // 极有可能因为浏览器的同源策略 (Same-Origin Policy) 而失败。
            // 服务器需要配置正确的 CORS 头 (Access-Control-Allow-Origin) 允许当前网页的源。
            // 如果请求失败，请检查浏览器控制台的 CORS 错误。
            // 理想的解决方案是使用后端代理来转发此请求。
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // 可能需要添加其他必要的 headers，例如认证信息，但这需要逆向分析或文档
                },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                // 尝试读取错误响应体，可能包含有用信息
                let errorBody = "无法获取详细错误信息";
                try {
                    errorBody = await response.text();
                } catch (e) {
                    /* 忽略读取错误 */
                }
                throw new Error(
                    `API 请求失败: ${response.status} ${response.statusText}. 响应体: ${errorBody}. (可能是 CORS 错误，请检查浏览器控制台)`
                );
            }

            const result = await response.json();

            // 检查 API 返回的数据结构是否符合预期
            if (result.code === 200 && Array.isArray(result.data)) {
                return result.data;
            } else {
                throw new Error(
                    `API 返回数据格式错误或操作失败: ${result.msg || "未知错误"}`
                );
            }
        } catch (error) {
            console.error("API 调用失败:", error);
            setError(`获取文件列表失败: ${error.message}`);
            return []; // 返回空数组表示失败
        } finally {
            setLoading(false);
        }
    }

    /**
     * 渲染文件列表到页面
     * @param {Array} files - 文件信息数组
     */
    function renderFileList(files) {
        fileListContainer.innerHTML = ""; // 清空现有列表
        fileListData = files; // 更新全局状态

        if (files.length === 0) {
            fileListContainer.innerHTML =
                '<p class="text-gray-500 italic">未能获取到文件列表，或列表为空。</p>';
            downloadAllBtn.classList.add("hidden");
            return;
        }

        files.forEach((file, index) => {
            const fileName = file.c_wsmc || `未命名文件_${index + 1}`;
            const fileExtension =
                file.c_wjgs || getExtensionFromUrl(file.wjlj) || "file"; // 尝试获取后缀
            const fullFileName = `${fileName}.${fileExtension}`;
            const fileUrl = file.wjlj;

            const fileItem = document.createElement("div");
            fileItem.className =
                "p-3 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-200";
            // Framer Motion 简单入场动画 (示例)
            // fileItem.setAttribute('initial', '{ opacity: 0, y: 20 }');
            // fileItem.setAttribute('animate', '{ opacity: 1, y: 0 }');
            // fileItem.setAttribute('transition', `{ delay: ${index * 0.05} }`);
            // 注意：直接在 JS 中设置 motion 属性可能不生效，通常在 HTML 模板中使用

            fileItem.innerHTML = `
                <div class="flex items-center space-x-3 overflow-hidden mr-4">
                    <i class="fas ${getFileIcon(
                fileExtension
            )} text-blue-500 fa-lg"></i>
                    <span class="truncate text-sm text-gray-700" title="${fullFileName}">${fullFileName}</span>
                </div>
                <button class="btn btn-secondary btn-sm download-single-btn whitespace-nowrap px-2" data-url="${fileUrl}" data-filename="${fullFileName}">
                    <i class="fas fa-download mr-1"></i>下载
                </button>
            `;
            fileListContainer.appendChild(fileItem);

            // 添加 Framer Motion 动画 (JS 方式，如果 motion 对象可用)
            if (motion) {
                motion(fileItem, {
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: index * 0.05 },
                });
            }
        });

        // 为新添加的下载按钮绑定事件
        document.querySelectorAll(".download-single-btn").forEach((button) => {
            button.addEventListener("click", handleSingleDownload);
        });

        downloadAllBtn.classList.remove("hidden"); // 显示全部下载按钮
    }

    /**
     * 根据文件扩展名获取 Font Awesome 图标类
     * @param {string} extension - 文件扩展名 (小写)
     * @returns {string} - Font Awesome 图标类
     */
    function getFileIcon(extension) {
        switch (extension.toLowerCase()) {
            case "pdf":
                return "fa-file-pdf";
            case "doc":
            case "docx":
                return "fa-file-word";
            case "xls":
            case "xlsx":
                return "fa-file-excel";
            case "ppt":
            case "pptx":
                return "fa-file-powerpoint";
            case "zip":
            case "rar":
                return "fa-file-archive";
            case "jpg":
            case "jpeg":
            case "png":
            case "gif":
                return "fa-file-image";
            case "txt":
                return "fa-file-alt";
            default:
                return "fa-file";
        }
    }

    /**
     * 从 URL 中提取文件扩展名
     * @param {string} urlString - 文件 URL
     * @returns {string|null} - 小写扩展名或 null
     */
    function getExtensionFromUrl(urlString) {
        try {
            const url = new URL(urlString);
            const pathname = url.pathname;
            const lastDotIndex = pathname.lastIndexOf(".");
            if (lastDotIndex > 0 && lastDotIndex < pathname.length - 1) {
                // 确保点不是路径的第一个或最后一个字符
                return pathname.substring(lastDotIndex + 1).toLowerCase();
            }
        } catch (e) {
            // URL 解析失败或路径中没有点
        }
        // 尝试从文件名中提取（如果 URL 路径像文件名）
        const filenameMatch = urlString.match(/[^/\\&?]+\.\w{3,4}(?=([?&].*$|$))/);
        if (filenameMatch) {
            const lastDotIndex = filenameMatch[0].lastIndexOf(".");
            if (lastDotIndex > 0) {
                return filenameMatch[0].substring(lastDotIndex + 1).toLowerCase();
            }
        }
        return null;
    }

    /**
     * 触发文件下载
     * @param {string} url - 文件 URL
     * @param {string} filename - 下载时使用的文件名
     */
    /**
     * 使用 <a> 标签模拟点击下载 (旧方法/回退方法)
     * @param {string} url
     * @param {string} filename
     * @returns {boolean} - true if link click was simulated, false on error
     */
    function downloadFileWithLink(url, filename) {
        console.log(`尝试下载 (Link): ${filename} 从 ${url}`);
        try {
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            // link.target = '_blank'; // 不建议，可能导致更多问题
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // 注意：<a> 标签点击总是“成功”启动，但不保证实际下载成功或内容正确
            return true;
        } catch (error) {
            console.error(`使用 <a> 标签下载文件 ${filename} 失败:`, error);
            return false;
        }
    }
    /**
     * 尝试使用 Fetch + Blob 下载文件，失败则回退到 <a> 标签方法
     * @param {string} url - 文件 URL
     * @param {string} filename - 下载时使用的文件名
     * @returns {Promise<boolean>} - true 如果下载尝试成功启动 (fetch 或 link), false 如果 fetch 和 link 都失败
     */
    async function downloadFile(url, filename) {
        console.log(`尝试下载 (Fetch): ${filename} 从 ${url}`);
        try {
            // 尝试 Fetch 请求
            // 注意：如果目标服务器没有配置 CORS，这里会直接抛出网络错误
            const response = await fetch(url, {
                method: "GET",
                // mode: 'cors', // 默认就是 cors，如果需要 no-cors，则无法读取响应体
                // headers: { // 如果需要特定 header
                //   'Accept': 'application/octet-stream' // 尝试请求二进制流
                // }
            });

            if (!response.ok) {
                // Fetch 成功但 HTTP 状态码表示错误 (e.g., 404, 500)
                console.warn(
                    `Fetch 请求失败，状态码: ${response.status} for ${filename}. 回退到 Link 下载。`
                );
                return downloadFileWithLink(url, filename);
            }

            const blob = await response.blob();

            // 检查 Blob 类型，防止下载的是 HTML 错误页面等非预期内容
            // 注意：对于某些服务器返回的 PDF，blob.type 可能为空字符串或 application/octet-stream，
            // 所以仅检查 text/html 可能不够，但这是一个基本的保护措施。
            if (blob.type && blob.type.toLowerCase().includes("text/html")) {
                console.warn(
                    `Fetch 到的内容类型为 ${blob.type} (可能为错误页) for ${filename}. 回退到 Link 下载。`
                );
                return downloadFileWithLink(url, filename);
            }

            // 创建 Blob URL
            const blobUrl = URL.createObjectURL(blob);

            // 使用 Blob URL 进行下载
            console.log(`Fetch 成功，使用 Blob URL 下载: ${filename}`);
            const success = downloadFileWithLink(blobUrl, filename); // 复用 link 下载逻辑

            // 释放 Blob URL 资源 (延迟执行以确保下载启动)
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

            return success; // 返回 link 下载的启动结果
        } catch (error) {
            // Fetch 请求本身失败 (网络错误, CORS 错误等)
            console.error(
                `Fetch 下载 ${filename} 失败: ${error}. 回退到 Link 下载。`
            );
            // setError(`下载文件 ${filename} 时出错 (Fetch): ${error.message}. 尝试备用方法...`); // 可以在这里加错误提示，但可能过多
            return downloadFileWithLink(url, filename); // 回退到原始方法
        }
    }

    // --- Event Handlers ---

    /**
     * 处理解析按钮点击事件
     */
    async function handleParseClick() {
        setError(null);
        // updateParamsDisplay(null); // 不再需要更新参数显示
        fileListContainer.innerHTML =
            '<p class="text-gray-500 italic">请先输入短信内容并点击获取文书列表按钮。</p>'; // 更新提示文本
        downloadAllBtn.classList.add("hidden"); // 隐藏下载按钮
        fileListData = []; // 清空文件数据
        downloadStatus.textContent = "";

        const smsContent = urlInput.value.trim(); // 现在获取的是短信内容
        if (!smsContent) {
            setError("请输入法院发送的短信内容"); // 更新错误提示
            return;
        }

        // 从短信内容中提取 URL 并解析参数
        const params = extractUrlAndParamsFromSms(smsContent);
        if (!params) {
            // 错误信息已在 extractUrlAndParamsFromSms 中设置
            return;
        }

        // updateParamsDisplay(params); // 不再需要更新参数显示

        // 调用 API 获取文件列表
        const files = await fetchFileList(params);

        // 渲染文件列表
        renderFileList(files);
    }

    /**
     * 处理单个文件下载按钮点击事件 (异步)
     * @param {Event} event
     */
    async function handleSingleDownload(event) {
        const button = event.currentTarget;
        const url = button.dataset.url;
        const filename = button.dataset.filename;

        if (!url || !filename) {
            console.error("下载按钮缺少必要的 data 属性");
            setError("无法下载文件：缺少文件信息。");
            return;
        }

        button.disabled = true; // 禁用当前按钮
        button.classList.add("opacity-50", "cursor-not-allowed");
        const originalButtonText = button.innerHTML; // 保存原始按钮内容
        button.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> 下载中...`; // 更新按钮状态

        downloadStatus.textContent = `正在准备下载: ${filename}...`;
        setError(null); // 清除旧错误

        try {
            const success = await downloadFile(url, filename); // 调用异步下载

            if (success) {
                downloadStatus.textContent = `已尝试启动下载: ${filename} (请检查浏览器下载列表)`;
            } else {
                downloadStatus.textContent = `下载 ${filename} 失败或被阻止，请检查控制台或网络。`;
                setError(`下载 ${filename} 失败或被阻止。`);
            }
        } catch (error) {
            console.error(`处理单个下载 ${filename} 时发生错误:`, error);
            downloadStatus.textContent = `下载 ${filename} 时发生错误。`;
            setError(`下载 ${filename} 时出错: ${error.message}`);
        } finally {
            // 重新启用按钮并恢复原始内容
            button.disabled = false;
            button.classList.remove("opacity-50", "cursor-not-allowed");
            button.innerHTML = originalButtonText;
        }
    }

    /**
     * 处理全部下载按钮点击事件 (异步)
     */
    async function handleDownloadAll() {
        if (fileListData.length === 0) {
            setError("没有可下载的文件。");
            return;
        }

        // --- 更强的用户提示 ---
        const userConfirmation = confirm(
            `你将尝试下载 ${fileListData.length} 个文件。\n\n` +
            `重要提示：\n` +
            `- 浏览器可能会阻止连续下载，请留意浏览器顶部的提示并选择“允许”或“保存”。\n` +
            `- Fetch 方法可能因 CORS 限制失败，将自动回退。\n` +
            `- 部分文件仍可能因服务器设置或网络问题下载失败。\n\n` +
            `是否继续？`
        );

        if (!userConfirmation) {
            downloadStatus.textContent = "批量下载已取消。";
            return;
        }
        // --- 提示结束 ---

        downloadAllBtn.disabled = true; // 禁用按钮
        downloadAllBtn.classList.add("opacity-50", "cursor-not-allowed");
        downloadStatus.textContent = `正在初始化批量下载 ${fileListData.length} 个文件...`;
        setError(null);

        let downloadedCount = 0;
        let failedCount = 0;
        const totalFiles = fileListData.length;
        const downloadInterval = 1000; // 增加间隔时间，给 fetch 和用户反应时间

        downloadStatus.textContent = `开始尝试下载... (0/${totalFiles})`;

        try {
            // 使用 for...of 循环配合 await 来按顺序处理下载
            for (let index = 0; index < fileListData.length; index++) {
                const file = fileListData[index];
                const fileName = file.c_wsmc || `未命名文件_${index + 1}`;
                const fileExtension =
                    file.c_wjgs || getExtensionFromUrl(file.wjlj) || "file";
                const fullFileName = `${fileName}.${fileExtension}`;
                const fileUrl = file.wjlj;

                // 更新状态
                downloadStatus.textContent = `[${
                    index + 1
                }/${totalFiles}] 尝试下载: ${fullFileName}... (已成功: ${downloadedCount}, 已失败: ${failedCount})`;

                // 调用异步下载函数
                const success = await downloadFile(fileUrl, fullFileName);

                if (success) {
                    downloadedCount++;
                } else {
                    failedCount++;
                    console.warn(`文件 ${fullFileName} 下载尝试启动失败或被阻止。`);
                }

                // 更新进度显示
                const currentProgress = downloadedCount + failedCount;
                downloadStatus.textContent = `[${currentProgress}/${totalFiles}] 处理完成: ${fullFileName}. (成功: ${downloadedCount}, 失败: ${failedCount})`;

                // 在每次下载后添加延迟（除了最后一次）
                if (index < totalFiles - 1) {
                    await new Promise((resolve) => setTimeout(resolve, downloadInterval));
                }
            }

            // 下载循环结束后的最终消息
            let finalMessage = `批量下载尝试完成: ${totalFiles} 个文件 (成功启动: ${downloadedCount}, 失败/阻止: ${failedCount})`;
            if (failedCount > 0) {
                finalMessage += `。部分文件下载失败或被阻止，请检查浏览器下载内容或控制台日志。`;
                setError(`${failedCount} 个文件下载失败或被阻止。`);
            } else {
                finalMessage += `。所有文件已成功启动下载（请检查浏览器下载列表）。`;
            }
            downloadStatus.textContent = finalMessage;
        } catch (error) {
            // 捕获意外错误
            console.error("批量下载过程中发生意外错误:", error);
            setError(`批量下载中断: ${error.message}`);
            downloadStatus.textContent = "批量下载因错误中断。";
        } finally {
            // 无论成功或失败，最终都重新启用按钮
            downloadAllBtn.disabled = false;
            downloadAllBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }
    // --- Event Listeners ---
    parseBtn.addEventListener("click", handleParseClick);
    downloadAllBtn.addEventListener("click", handleDownloadAll);

    // --- Initial Setup ---
    // (可以在这里添加一些初始动画或设置)
})(); // End of IIFE
