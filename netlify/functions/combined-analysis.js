/**
 * Netlify Function：紫微 + 霍兰德 综合分析（Streaming 无超时版）
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// 你原来的霍兰德/紫微分析辅助函数完全保留
// …………………………………………
// …………………………………………
// 这里省略（保持你的逻辑不动）
// …………………………………………


// 🟦 核心函数：调用 DeepSeek（流式返回）
async function callDeepSeekStream(prompt) {
    const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            stream: true,
            messages: [
                { role: "system", content: "你是一位资深的命理与职业规划专家，请根据提供的数据生成分析。" },
                { role: "user", content: prompt }
            ]
        })
    });

    if (!response.ok) {
        throw new Error("DeepSeek API error: " + response.statusText);
    }

    return response.body; // 🔥 返回流（ReadableStream）
}


// 🔥 Netlify handler（流式输出，不会 timeout）
exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let request;
    try {
        request = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: "Invalid JSON" };
    }

    // 你原本的紫微分析 + 霍兰德分析逻辑
    // 这里计算 ziweiResult、hollandResult
    // …………………………………………  
    // （我保留你的部分，不做更改）
    // …………………………………………

    const finalPrompt = `
请根据以下信息做出综合职业方向分析：

【紫微斗数】
命主：${request.ziweiAnalysis.userInfo.soul}
身主：${request.ziweiAnalysis.userInfo.body}
五行局：${request.ziweiAnalysis.userInfo.fiveElementsClass}

【霍兰德测试】
主要类型：${request.hollandResult.primaryTypeName}
代码：${request.hollandResult.hollandCode}
得分：${request.hollandResult.primaryScore}

请结合两者，生成详细的学习方向/专业选择建议。
    `.trim();

    const deepseekStream = await callDeepSeekStream(finalPrompt);

    return {
        statusCode: 200,
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        },
        body: deepseekStream
    };
};
