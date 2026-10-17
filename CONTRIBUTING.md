# Contributing

Report an improvement with a reproducible input, expected behavior and actual behavior. Use synthetic examples; never submit private conversations, credentials or personal data. Open a GitHub issue before adding a provider, retrieval backend or tool subsystem.

For a behavior fix, add a failing regression case, implement the change, update the application/prompt/policy version as needed, and explain which quality dimension improved or regressed. Keep model comparisons and production routing separate. Provider racing is outside the project's intended runtime design.

Run `npm ci`, `npm run check`, `npm test`, `npm run build`, and `npm run eval -- --mock --models openai/gpt-6-luna --repeats 1`. Mock tests verify wiring only. Maintainers run paid evaluations with their own budgets; contributor PRs never receive API keys. Do not commit `eval/runs`, reviews with identifying information, `.env` files or copied production data.

Benchmark changes must preserve old reports. If a dataset or evaluator changes, rerun both compared versions against the same test definition. Include failures and unknown costs. Do not call a default model optimal without the documented acceptance criteria and independent human review.

Feedback becomes a reviewed issue, a synthetic regression case, a measured fix and a versioned release. Feedback does not directly modify a live prompt or train a model automatically.
