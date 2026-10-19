"""Project-owned Harness² seam for deterministic source-preserving GTM contracts.

This is a contract benchmark, not a language-model or editorial quality benchmark.
Imported only inside the isolated worker. No provider executor is used.
"""
import hashlib
import json
from pathlib import Path

from harness2.core import tree
from harness2.core.proposer import Proposer, Reply
from harness2.core.spec import BenchPrompts, BenchSpec, ChannelSpec


class GtmSubstrate:
    # The pinned prompt renderer accepts only these upstream profile names.
    # Execution remains the project-owned deterministic adapter, never OpenCode CLI.
    name = "opencode"

    def surface(self):
        return tree.SurfaceSpec(
            name=self.name, always_on=("guardrails.md",), always_on_max=4000,
            always_on_cap_reason="Bounded project-only instructions",
            skill_dir="skills", skill_name_rule="must_match", trigger_hint="",
            autotrigger_file="guardrails.md", trigger_line="", subagent_requires_mode=True,
            plugin_dir=None, hooks_file=None,
        )


class GtmAdapter:
    def __init__(self, root: Path, fixture_path: Path):
        self.root = root
        self.substrate = GtmSubstrate()
        self.inputs = json.loads(fixture_path.read_text())
        channel = ChannelSpec("opencode", "local/deterministic", steps=1, timeout=10)
        self.spec = BenchSpec(
            name="gtm-contracts-v1", runs_root=root / "runs", install_mode="workspace_config",
            prompts=BenchPrompts(work="prepare source-preserving tenant-scoped GTM handoffs"),
            channels={"proposer": channel, "selector": channel},
            leak_globs=("answers/**", "sealed/**", "private/**"), allow_subagents=False,
        )
        self.execution_count = 0
        tree.write_tree(self.substrate.surface(), {"guardrails.md": "Preserve source text and tenant. No publication or verification upgrade.\n"}, self.base_harness())
        for item in self.inputs:
            source = self.task_files(item["id"])
            source.mkdir(parents=True, exist_ok=True)
            (source / "source.json").write_text(json.dumps(item, sort_keys=True))

    def tasks(self, split="all"):
        if split not in ("all", "global", "gtm"):
            raise ValueError("Unknown public split")
        return [v["id"] for v in self.inputs if split == "all" or v["suite"] == split]

    def domain_of(self, task_id):
        self._input(task_id)
        return "gtm"

    def _input(self, task_id):
        return next(v for v in self.inputs if v["id"] == task_id)

    def task_prompt(self, task_id):
        self._input(task_id)
        return "Prepare a local handoff preserving source text, tenant, revision and limitations. Do not publish."

    def task_files(self, task_id):
        if not task_id.replace("-", "").isalnum():
            raise ValueError("Invalid task ID")
        return self.root / "sources" / task_id

    def base_harness(self):
        return self.root / "base"

    def validate_tree(self, harness):
        if set(harness) != {"guardrails.md"} or len(harness["guardrails.md"]) > 4000:
            raise ValueError("Only bounded guardrails.md edits are permitted")
        if "No publication or verification upgrade." not in harness["guardrails.md"]:
            raise ValueError("Immutable publication boundary is required")

    def execute(self, task_id, harness_dir, run_id, *, timeout=None):
        if not run_id or Path(run_id).is_absolute() or ".." in Path(run_id).parts:
            raise ValueError("Invalid run ID")
        harness = tree.read_tree(self.substrate.surface(), harness_dir or self.base_harness())
        self.validate_tree(harness)
        source = self._input(task_id)
        # Instructions are data: no eval, exec, shell, provider or candidate script execution.
        payload = {"tenant": source["tenant"], "label": "SYNTHETIC", "revision": source["revision"],
                   "statement": source["statement"], "limitations": source["limitations"],
                   "sourceSha256": hashlib.sha256(source["statement"].encode()).hexdigest(),
                   "publicationAuthorized": False, "platformVerified": False,
                   "humanReview": "REQUIRED", "hostedModelRequests": 0}
        run_dir = self.root / "executions" / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        encoded = json.dumps(payload, sort_keys=True)
        answer = run_dir / "handoff.json"
        if answer.exists():
            if answer.read_text() != encoded:
                raise ValueError("Idempotency conflict")
            return run_dir
        answer.write_text(encoded)
        (run_dir / "trajectory.md").write_text("[ACTION] Assemble source-preserving local handoff\n[OBSERVATION]\n" + encoded)
        self.execution_count += 1
        return run_dir

    def delivered(self, run_dir):
        return (run_dir / "handoff.json").is_file()

    def trajectory(self, run_dir, *, obs_trunc):
        return (run_dir / "trajectory.md").read_text()[:obs_trunc]

    def deliverable_text(self, run_dir):
        return (run_dir / "handoff.json").read_text()

    def deliverable_files(self, run_dir):
        return {"handoff.json": self.deliverable_text(run_dir)}

    def score(self, run_dir, task_id):
        # Independent trusted parent grades only after selection; no answers in candidate context.
        return None


class OfflineProposer(Proposer):
    """The upstream deterministic-demo pattern; never calls Proposer.call()."""

    def call(self, mission, context_dir, label, **kwargs):
        context = Path(context_dir)
        workspace = None
        if label.startswith("select."):
            candidates = sorted((context / "candidates").glob("*.md"))
            text = f"<why>Deterministic stable order; no quality improvement is inferred.</why>\n```choice\n{candidates[0].stem}\n```"
        elif label.startswith("experience."):
            text = "NO_ENTRY"
        else:
            workspace = context / "harness"
            path = workspace / "guardrails.md"
            path.write_text(path.read_text().rstrip() + "\nKeep source revision visible in the handoff.\n")
            text = "<notes>Clarify a local instruction; behavior improvement remains unproven.</notes>"
        reply = Reply(label=label, text=text, ok=True, attempts=1, workspace=workspace)
        self._calls.append(reply)
        return reply
