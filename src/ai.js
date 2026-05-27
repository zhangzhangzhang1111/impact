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

function trimForContext(input, aiConfig) {
  return {
    ...input,
    changedFunctions: input.changedFunctions.slice(0, aiConfig.maxChangedFunctions ?? 60),
    impactFunctions: input.impactFunctions.slice(0, aiConfig.maxImpactFunctions ?? 80)
  };
}

function buildSystemPrompt(config) {
  return [
    "You are a senior code impact analyst. Return strict JSON with keys impactSummary, testSuggestions, reviewFindings.",
    "Focus on changed functions and two-layer callers. Be concise and actionable.",
    "Business notes:",
    ...config.businessNotes.map((item) => `- ${item}`),
    "Review rules:",
    ...config.reviewRules.map((item) => `- ${item}`)
  ].join("\n");
}

function localAnalysis(input, config) {
  const changed = input.changedFunctions.map((item) => item.symbol).join(", ") || "none";
  const impacted = input.impactFunctions.filter((item) => item.depth > 0).map((item) => item.symbol).slice(0, 10);
  return {
    impactSummary: [
      `Changed functions: ${changed}.`,
      impacted.length ? `Potential callers affected within two layers: ${impacted.join(", ")}.` : "No caller impact was found within two layers.",
      config.businessNotes.length ? `Project notes: ${config.businessNotes.join(" ")}` : "AI is not configured; this is a deterministic local summary."
    ].join("\n"),
    testSuggestions: [
      "Run unit tests covering each changed function and its direct callers.",
      "Run integration tests for flows represented by second-layer callers.",
      "Add regression cases around boundary inputs, error paths, and rollback behavior."
    ],
    reviewFindings: config.reviewRules.slice(0, 8)
  };
}
