export async function analyzeWithAi(input, config) {
  const payload = trimForContext(input, config.ai);
  if (!config.ai.enabled) {
    return localAnalysis(payload, config);
  }
  if (!config.ai.apiKey) {
    throw new Error("AI analysis is enabled but ai.apiKey or IMPACT_AI_API_KEY is not configured.");
  }

  const response = await fetch(config.ai.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.ai.apiKey}`
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: "system", content: buildSystemPrompt(config) },
        { role: "user", content: JSON.stringify(payload) }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response did not include choices[0].message.content.");
  }
  return JSON.parse(content);
}

function trimForContext(input, aiConfig = {}) {
  return {
    ...input,
    changedFunctions: input.changedFunctions.slice(0, aiConfig.maxChangedFunctions ?? 60),
    impactFunctions: input.impactFunctions.slice(0, aiConfig.maxImpactFunctions ?? 80),
    sourceContexts: (input.sourceContexts ?? []).slice(0, aiConfig.maxSourceContexts ?? 80),
    functionDiffs: (input.functionDiffs ?? []).slice(0, aiConfig.maxChangedFunctions ?? 60)
  };
}

function buildSystemPrompt(config) {
  return [
    "你是资深代码影响面分析专家。必须返回严格 JSON，包含 impactSummary, riskAssessments, testSuggestions, reviewFindings。",
    "所有自然语言内容必须使用中文。",
    "riskAssessments 必须是 {risk, symbol, reason, evidence} 数组；risk 只能是 高、中、低。",
    "结合变更函数 diff、源码片段和两层调用方。结论要简洁、可执行。",
    "Business notes:",
    ...config.businessNotes.map((item) => `- ${item}`),
    "Review rules:",
    ...config.reviewRules.map((item) => `- ${item}`)
  ].join("\n");
}

function localAnalysis(input, config) {
  const changed = input.changedFunctions.map((item) => item.symbol).join(", ") || "无";
  const impacted = input.impactFunctions.filter((item) => item.depth > 0).map((item) => item.symbol).slice(0, 10);
  const riskAssessments = input.impactFunctions.map((item) => ({
    risk: item.depth === 0 ? "高" : item.depth === 1 ? "中" : "低",
    symbol: item.symbol,
    reason: item.depth === 0
      ? "变更函数本身需要最高优先级验证。"
      : item.depth === 1
        ? "直接调用方可能继承接口、数据或异常语义变化。"
        : "二层调用方存在间接业务回归风险。",
    evidence: item.reason
  }));
  return {
    impactSummary: [
      `变更函数: ${changed}。`,
      impacted.length ? `两层调用链内可能受影响的调用方: ${impacted.join(", ")}。` : "两层调用链内未发现调用方影响。",
      input.sourceContexts?.length ? `已收集源码片段: ${input.sourceContexts.length} 个。` : "未收集到源码片段。",
      config.businessNotes.length ? `项目补充说明: ${config.businessNotes.join(" ")}` : "未配置 AI，当前为本地确定性中文摘要。"
    ].join("\n"),
    riskAssessments,
    testSuggestions: [
      "运行覆盖每个变更函数及其直接调用方的单元测试。",
      "运行二层调用方代表业务流程的集成测试。",
      "补充边界输入、异常路径和回滚行为的回归用例。"
    ],
    reviewFindings: config.reviewRules.slice(0, 8)
  };
}
