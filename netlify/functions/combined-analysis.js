// Netlify Functions - 紫微 + 霍兰德 + DeepSeek流式综合分析（最终稳定版）

let astro;
try {
    const iztro = require("iztro");
    astro = iztro.astro;
    console.log("✅ iztro库加载成功");
} catch (error) {
    console.error("❌ iztro库加载失败:", error);
    astro = null;
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// =========================
// 主 handler（核心入口）
// =========================
exports.handler = async (event, context) => {
    const headersJson = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    console.log("🚀 Netlify Function启动");

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: headersJson, body: "" };
    }

    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers: headersJson,
            body: JSON.stringify({ success: false, message: "Method not allowed" })
        };
    }

    console.log("📥 解析请求数据...");
    let requestData;
    try {
        requestData = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            headers: headersJson,
            body: JSON.stringify({ success: false, message: "请求数据格式错误" })
        };
    }

    const {
        name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute = 0, location = "北京",
        hollandAnswers, ziweiAnalysis
    } = requestData;

    // 霍兰德检测
    if (!hollandAnswers || !Array.isArray(hollandAnswers) || hollandAnswers.length !== 24) {
        return {
            statusCode: 400,
            headers: headersJson,
            body: JSON.stringify({
                success: false,
                message: "霍兰德测试答案不完整，需要24题"
            })
        };
    }

    console.log("📊 计算霍兰德结果...");
    const hollandScores = calculateHollandScores(hollandAnswers);
    const hollandResult = analyzeHollandResult(hollandScores);

    console.log("🔮 紫微排盘...");
    let ziweiAnalysisData = ziweiAnalysis;
    if (!ziweiAnalysisData && astro) {
        try {
            ziweiAnalysisData = await generateZiweiAnalysis({
                name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute, location
            });
        } catch (e) {
            ziweiAnalysisData = generateFallbackZiweiData({ name, gender });
        }
    } else if (!ziweiAnalysisData) {
        ziweiAnalysisData = generateFallbackZiweiData({ name, gender });
    }

    console.log("🤖 开始DeepSeek 流式综合分析...");

    // ============
    // 🚀 流式输出入口（核心修改点）
    // ============
    const stream = await callDeepSeekStream(
        ziweiAnalysisData,
        hollandResult,
        { name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute, location }
    );

    // 输出 SSE
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        },
        body: streamToNetlifyBody(stream)
    };
};

// =====================================================
// 流式 DeepSeek 综合分析（核心）
// =====================================================
async function callDeepSeekStream(ziweiData, hollandResult, userData) {
    if (!DEEPSEEK_API_KEY) {
        return fallbackStream("DeepSeek API Key 缺失。");
    }

    const prompt = buildCombinedAnalysisPrompt(ziweiData, hollandResult, userData);

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            stream: true,
            messages: [
                { role: "system", content: "你是一位专业的国学与现代测评综合专家。" },
                { role: "user", content: prompt }
            ],
            temperature: 0.6,
            max_tokens: 1500
        })
    });

    return response.body;
}

// ===========================================
// 将流转成 Netlify 能输出的 SSE（关键工具）
// ===========================================
function streamToNetlifyBody(stream) {
    return {
        async *[Symbol.asyncIterator]() {
            const reader = stream.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split("\n");

                for (const line of lines) {
                    if (!line.startsWith("data:")) continue;

                    const data = line.replace("data:", "").trim();
                    if (data === "[DONE]") {
                        yield "data: [DONE]\n\n";
                        return;
                    }
                    yield `data: ${data}\n\n`;
                }
            }
        }
    };
}

function fallbackStream(text) {
    return {
        async *[Symbol.asyncIterator]() {
            yield `data: ${text}\n\n`;
            yield `data: [DONE]\n\n`;
        }
    };
}


// =====================================================
// 🟪 下面所有内容都保持你原样（紫微 + 霍兰德 + fallback）
// =====================================================

// == 紫微排盘 ==
// （完全保持你原来的实现）
async function generateZiweiAnalysis(data) {
    const { name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute, location } = data;

    if (!astro) throw new Error("iztro不可用");

    function getTimeIndex(hour, minute = 0) {
        const t = hour * 60 + minute;
        if (t >= 1380 || t < 60) return 0;
        if (t < 180) return 1;
        if (t < 300) return 2;
        if (t < 420) return 3;
        if (t < 540) return 4;
        if (t < 660) return 5;
        if (t < 780) return 6;
        if (t < 900) return 7;
        if (t < 1020) return 8;
        if (t < 1140) return 9;
        if (t < 1260) return 10;
        return 11;
    }

    const solarDateStr = `${birthYear}-${String(birthMonth).padStart(2,"0")}-${String(birthDay).padStart(2,"0")}`;
    const timeIndex = getTimeIndex(birthHour, birthMinute);

    const astrolabe = astro.bySolar(solarDateStr, timeIndex, gender, true, "zh-CN");

    const dataOut = {
        userInfo: {
            name,
            gender,
            solarDate: astrolabe.solarDate,
            lunarDate: astrolabe.lunarDate,
            chineseDate: astrolabe.chineseDate,
            zodiac: astrolabe.zodiac,
            soul: astrolabe.soul,
            body: astrolabe.body,
            fiveElementsClass: astrolabe.fiveElementsClass,
            birthHour,
            location
        },
        palaces: {}
    };

    const palaceNames = [
        "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
        "迁移", "奴仆", "官禄", "田宅", "福德", "父母"
    ];

    palaceNames.forEach(name => {
        try {
            const palace = astrolabe.palace(name);
            dataOut.palaces[name] = {
                name,
                position: palace?.earthlyBranch || "",
                majorStars: palace.majorStars?.map(s => ({
                    name: s.name, brightness: s.brightness || "平", mutagen: s.mutagen || null
                })) || [],
                minorStars: palace.minorStars?.map(s => ({
                    name: s.name, type: s.type, mutagen: s.mutagen || null
                })) || []
            };
        } catch {
            dataOut.palaces[name] = { name, position: "", majorStars: [], minorStars: [] };
        }
    });

    return dataOut;
}

function generateFallbackZiweiData({ name, gender }) {
    return {
        userInfo: {
            name,
            gender,
            solarDate: new Date().toISOString().split("T")[0],
            lunarDate: "未知",
            chineseDate: "未知",
            zodiac: "未知",
            soul: "未知",
            body: "未知",
            fiveElementsClass: "未知",
            location: "北京"
        },
        palaces: {},
        deepseekAnalysis: {
            type: "fallback",
            content: "排盘失败，返回基础分析。",
            timestamp: new Date().toISOString()
        }
    };
}

// ===== 霍兰德 =====
function calculateHollandScores(answers) {
    const map = {
        R:[0,1,2,3], I:[4,5,6,7], A:[8,9,10,11],
        S:[12,13,14,15], E:[16,17,18,19], C:[20,21,22,23]
    };
    const scores = {};
    for (const t in map)
        scores[t] = map[t].reduce((a,i)=>a + (answers[i]||0), 0);
    return scores;
}

function analyzeHollandResult(scores) {
    const typeNames = {
        R:"现实型", I:"研究型", A:"艺术型",
        S:"社会型", E:"企业型", C:"常规型"
    };

    const sorted = Object.entries(scores)
        .sort((a,b)=>b[1]-a[1])
        .map(([t,s])=>({type:t,score:s,name:typeNames[t]}));

    const primary = sorted[0].type;
    const top3 = sorted.slice(0,3).map(t=>t.type).join("");

    return {
        primaryType: primary,
        primaryTypeName: typeNames[primary],
        primaryScore: sorted[0].score,
        hollandCode: top3,
        scores,
        sortedTypes: sorted,
        characteristics: getTypeCharacteristics(primary),
        workEnvironment: getWorkEnvironment(primary),
        developmentSuggestion: getDevelopmentSuggestion(primary),
        majorRecommendations: generateMajorRecommendations(primary)
    };
}

function getTypeCharacteristics(t){
    const data={
        R:["动手能力强","务实","喜欢工具"],
        I:["逻辑强","研究型"],
        A:["创造","表现欲"],
        S:["社交好","共情强"],
        E:["领导","影响力"],
        C:["细致","守规则"]
    };
    return data[t]||[];
}
function getWorkEnvironment(t){
    const w={
        R:"动手技术类",
        I:"研究学术类",
        A:"创意自由类",
        S:"社交服务类",
        E:"管理竞争类",
        C:"规范秩序类"
    };
    return w[t]||"多类型环境";
}
function getDevelopmentSuggestion(t){
    const m={
        R:"多做实践训练",
        I:"强化逻辑学术能力",
        A:"培养创意表达",
        S:"提升沟通技巧",
        E:"训练管理能力",
        C:"提升执行效率"
    };
    return m[t]||"全面提升";
}
function generateMajorRecommendations(t){
    const data={
        R:[{name:"机械工程",match:95},{name:"土木工程",match:90}],
        I:[{name:"计算机科学",match:95},{name:"物理学",match:90}],
        A:[{name:"艺术设计",match:95},{name:"建筑学",match:88}],
        S:[{name:"心理学",match:95},{name:"教育学",match:90}],
        E:[{name:"工商管理",match:95},{name:"市场营销",match:90}],
        C:[{name:"会计学",match:95},{name:"法学",match:90}]
    };
    return data[t] || [];
}


// =========== 提示词构建 ============
function buildCombinedAnalysisPrompt(ziwei, holland, user){
    return `
请综合紫微斗数与霍兰德职业测试，为${user.name}提供专业的综合职业方向分析。

【霍兰德】
类型：${holland.primaryTypeName}
代码：${holland.hollandCode}
特质：${holland.characteristics.join("、")}

【分析要求】
1. 综合紫微命盘与霍兰德，找出共性与差异  
2. 给出最适合的职业方向  
3. 推荐 3-5 个大学专业（附理由）  
4. 给出未来发展路径建议  
    `;
}
