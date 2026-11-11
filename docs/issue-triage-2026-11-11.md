# Open issue triage — November 11, 2026

All 18 open GitHub issues are original milestone/acceptance issues. Implementation evidence does not satisfy unchecked partner sign-off or time-study criteria. This triage leaves their GitHub state unchanged.

| Issue | Current disposition | Remaining evidence or correction |
| --- | --- | --- |
| [1](https://github.com/IvayloNanev/syncflow/issues/1) Contracts | Implemented | Partner approval remains unrecorded |
| [2](https://github.com/IvayloNanev/syncflow/issues/2) Bootstrap | Implemented; unused Prisma removed | Verify setup on a fresh collaborator machine |
| [3](https://github.com/IvayloNanev/syncflow/issues/3) Evaluation corpus | Frozen 20 cases available | Partner answer-key approval remains |
| [4](https://github.com/IvayloNanev/syncflow/issues/4) Persistence | Hosted Postgres aggregate/CAS implemented | Architecture differs from initial normalized-schema proposal |
| [5](https://github.com/IvayloNanev/syncflow/issues/5) Intake | Implemented | Recall remains below target |
| [6](https://github.com/IvayloNanev/syncflow/issues/6) Review UI | Exception-driven workflow implemented | Initial per-field acceptance criteria superseded by current stories |
| [7](https://github.com/IvayloNanev/syncflow/issues/7) Review checks | Implemented | Incorrect-flag rate misses target |
| [8](https://github.com/IvayloNanev/syncflow/issues/8) Revisions | Revision and idempotency checks implemented | Retain regression coverage |
| [9](https://github.com/IvayloNanev/syncflow/issues/9) Follow-up | Drafting implemented | Human prose acceptance remains |
| [10](https://github.com/IvayloNanev/syncflow/issues/10) Copy/reply | Implemented | Copy is not send; separate sent-status tracking is not implemented |
| [11](https://github.com/IvayloNanev/syncflow/issues/11) Orchestration | Checkpointed background runs implemented in [PR #78](https://github.com/IvayloNanev/syncflow/pull/78) | Hosted navigation-away recovery verified with one synthetic case; uncertain paid calls need explicit retry |
| [12](https://github.com/IvayloNanev/syncflow/issues/12) Transitions | Guarded commands implemented | Current exception policy differs from original per-field gates |
| [13](https://github.com/IvayloNanev/syncflow/issues/13) Regression tests | Automated suite available | Passing tests do not establish human acceptance |
| [14](https://github.com/IvayloNanev/syncflow/issues/14) Internal review | Manager flow and history implemented | Reconcile original reviewer/per-field criteria with current product |
| [15](https://github.com/IvayloNanev/syncflow/issues/15) Accuracy/time study | Keep open | Recall gap and paired time study unresolved |
| [16](https://github.com/IvayloNanev/syncflow/issues/16) Dashboard/recovery | Implemented | [Background checkpoints](durable-ai.md) tested locally; hosted navigation-away/reopen check passed; production rollout remains |
| [17](https://github.com/IvayloNanev/syncflow/issues/17) Partner acceptance | Keep open | Full paired acceptance/demo not recorded |
| [18](https://github.com/IvayloNanev/syncflow/issues/18) Release/setup | Deployed; current setup documented | Both collaborators must verify clean setup |

Before closing an issue, update its acceptance wording to the current product and attach the missing evidence. Do not bulk-close milestones based on the test count.
