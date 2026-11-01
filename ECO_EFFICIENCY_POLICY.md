# ADPULSE — Eco-efficiency and infrastructure cost policy

## Objective
Deliver the maximum verified business value per unit of compute, storage, network traffic and external API spend. “Eco-efficient” means financial efficiency and lower unnecessary resource consumption; it is not an environmental certification or a claim of carbon neutrality.

## Engineering controls
- Prefer deterministic code and cached results over repeated LLM calls.
- Route simple tasks to smaller/cheaper models; use larger models only when evaluation proves quality improvement.
- Set per-tenant token, request, concurrency and monthly spend budgets.
- Batch asynchronous work where latency permits; deduplicate repeated events.
- Use idempotency, bounded retries and circuit breakers to avoid retry storms.
- Retain only necessary data; enforce TTL for disposable cache and logs; archive or delete according to contract and law.
- Right-size MySQL, Redis, workers and observability; enforce CPU/RAM limits and alert on sustained idle/overprovisioning.
- Use autoscaling only with hard cost ceilings and queue backpressure.
- Measure energy/carbon only when provider data and methodology are available; do not publish fabricated carbon savings.

## Monthly dashboard
- Compute-hours and CPU/RAM utilization by environment.
- LLM tokens, model mix, cache-hit rate and cost per successful workflow.
- Storage, egress and retention growth.
- Cost per tenant and gross margin after variable provider costs.
- Failed/retried jobs and duplicate side effects prevented.

## Release criteria
A new model, worker or integration must show incremental customer value that exceeds its variable cost and reliability risk. Avoid adding infrastructure components without measured load or operational need.
