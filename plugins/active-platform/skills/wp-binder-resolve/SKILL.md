---
name: wp-binder-resolve
description: Shared foundation — resolve a fuzzy client/binder reference ("Behemoth", "the Jackson year-end") into a concrete BinderContext. Run first whenever a Workpapers skill lacks one.
kind: skill
user-invocable: false
---

# wp-binder-resolve — which binder(s)?

Turn a fuzzy reference into one or more concrete `BinderContext` artifacts
(shape: `wp-ref-contracts`). **The 0-invariant:** every other
`wp-*` skill either receives a resolved `BinderContext` or begins by invoking this skill.
Never guess a binder silently.

**Inputs:** free-text reference; optional hints — `clientId`, `clientGroupId`, `binderTypeId`,
status; `anticipate-new-binders` (default `false`). **Output:** one `BinderContext`, or — on
**group scope** (a named group / `clientGroupId` hint) — a `BinderContext[]`, one per in-scope
entity binder; or a shortlist + a prompt to the user. **Side-effects:** none (may prompt). Read-only.

**`anticipate-new-binders` (default `false`) — resolve to existing binders only, unless the caller
opts in.** When `false` (the default), resolve **only to binders that actually exist**: an entity
with no open binder of the chosen type in the anchor year is out of scope, not a candidate. When
`true`, resolve may additionally **anticipate a not-yet-created binder** — offering a *read-only
prior-year basis* (last year's Completed binder, carried forward as this year's template) for a
requested year that has no binder of its own. Only a from-scratch, gap-identifying recipe
(`wp-client-queries-initial-request`) passes `true`; recipes that merely reason over already-recorded
state (`wp-client-queries-compile`, `wp-client-queries-file-and-followup`) take the default. See
the *Financial-year scope (resolved alongside job type)* section of `wp-ref-recipes`.

**If the `active-*` tools are not in your tool list, they are almost certainly deferred, not absent.**
Search for them by family prefix (`active-core-clients-`, `active-workpapers-binders-`) before you
conclude anything. If a search still finds nothing, call `active-core-me-capabilities-list` — it loads
up front precisely for this — and report what it returns: tools it lists as disabled name the licence
and who can lift it; tools it does not list are available, so the gap is the tool index and retrying by
exact name is the remedy. Never tell the user their connection is broken, and never ask them to
reconnect, on the strength of an empty tool list alone.

## Procedure

1. **Resolve the client — or the group.** `active-core-clients-search` with the free-text name;
   also check `active-core-clients-recent-list` — its `isRecent` / `isPinned` flags are the recency
   signal for tie-breaking. If the reference **names a group** ("the Jackson group") **or a
   `clientGroupId` hint is supplied**, use `active-core-clients-groups-search` and scope by
   `clientGroupId` — the result is **group-scoped**: take the group whole and **do not narrow to a
   single entity**. (A named single entity stays that entity; only an explicit group triggers group
   scope.)
2. **List candidate binders.** `active-workpapers-binders-search` scoped by `clientId: [...]`
   and/or `clientGroupId: [...]` (group ids expand to members) and/or `role`, filtered by
   `statusIds` / `binderTypeIds` when the reference hints at them ("the BAS" → Activity Statements;
   "year-end" → Accounts and Tax / Company FS & Tax), ordered via `orderBy` / `orderDir`. Default
   listing uses `openOnly` plus a 12-month-completed window, keeping all open binders + recently
   completed ones.
3. **Score and choose.** Relevance order: explicit match (name/type/FY named by the user) >
   recency/pinned > binder-type hint > **most-recent-open financial year** > open-status. Beyond the
   client, two dimensions are resolved — **job type** (which binder type) and **financial year**
   (which period) — both per
   the *Job-type scope for wp-binder-resolve* section of `wp-ref-recipes`. Reason about job
   type by its **semantic job-type family, not the literal `binderType.name`/id** — see
   the *Job-type families — relate types by meaning* section of `wp-ref-recipes`. Anchor the year
   to the latest `financialYearEndDate` that still has an **open** binder; an open binder on an older
   FY is last year's job running late, not the current one.
   - **Single-client reference** — **Auto-pick** a single unambiguous *open* binder in the
     most-recent-open FY; **Prompt** on ties, or when >1 binder is plausible — show a shortlist
     (binder name, type, FY, status) and let the user choose.
   - **Group scope** — **do not collapse to a single entity, and never prompt to pick a client
     within the group.** Carry **every in-scope entity's relevant binder** (a `BinderContext[]`).
     The **client/entity dimension is taken whole**; **job type** and **financial year** are still
     resolved: aggregate the distinct **job-type families** across the group (collapse
     semantically-equivalent binder types — e.g. a company's `Company Financial Statements & Tax` and
     a trust's/individual's `Accounts and Tax` are one year-end accounts-&-tax family, not two jobs)
     and ask which job type only when more than one *family* is present *and the request didn't name
     one* (accounts/tax pre-selected), then
     anchor the FY per the financial-year rules — **an explicitly named year wins and is never
     re-confirmed** — and apply it uniformly across every entity.
   - **Only prompt for a dimension the user hasn't already established.** When the request names the
     job type ("the BAS") or the financial year ("the 2026 jobs", "FY2026"), that dimension is
     pinned — **do not ask about it.** In particular, when the year is explicit, entities that lack
     an open binder of the chosen type in that year are simply **out of scope**: note them in one
     brief FYI line and proceed, rather than asking which to include.
   - **Entities with no open binder in the anchor year** — the ask below applies **only when the year
     was inferred, not stated.** If the year was inferred and entities' latest is Completed / only
     older years open / nothing, **never silently pick, drop, or create** — list them with their
     latest state and ask which to include (do not offer to create a binder). If nothing of the
     chosen type is open anywhere in the anchor year (the whole group's latest is Completed), there is
     no live job — say so and ask which years/entities to work from, even if a year was named.
     - **The prior-year-basis offer is gated on `anticipate-new-binders: true`.** When the entity's
       latest of the chosen type is a *Completed* prior-year binder **and the caller passed
       `anticipate-new-binders: true`**, include — among the choices offered — **basing a read-only
       request for the requested year on that prior binder** (carry its needs / queries forward as
       this year's template). If the user picks it, emit that prior-year binder as the `BinderContext`
       with **`readOnly: true`** (and `readOnlyReason` naming the requested year that has no binder).
       **Say in the option that it is read-only** — there is no binder for the requested year to
       record queries against, so the recipe can only draft the request; do not offer to create a
       binder.
     - **When `anticipate-new-binders` is `false` (the default), never offer a read-only prior-year
       basis, and never anticipate a binder that doesn't exist.** An entity whose latest of the chosen
       type is Completed (or has nothing open in the anchor year) is simply **out of scope**: report it
       in one brief FYI line with its latest state and proceed. The only inclusion question that may
       still be asked is whether to add **another binder that actually exists** — e.g. an entity with
       an open binder in a *different* year (the "also include this other open FY?" branch); that is a
       real binder, unaffected by this flag.
     Full rules: the *Financial-year scope (resolved alongside job type)* section of `wp-ref-recipes`.
4. **Prior-period link (cheap — from the same list; per resolved binder on group scope).** From the
   binders already listed for the chosen client, identify the immediately-prior-period binder of the
   **same engagement type**:
   same `binderTypeId`, `financialYearEndDate` exactly one period earlier, preferably status
   `Completed`. Set it as `priorBinderId`. Leave unset for first-year clients or when no
   comparable prior binder exists; **never guess across binder types**. (You may need to widen the
   completed window past the 12-month default to see older completed binders.)
5. **Build the artifact** (one per resolved binder — a `BinderContext[]` on group scope). Each
   `BinderContext` is a projection of the chosen list row **plus**
   `active-workpapers-binders-get` for `team` ({id,name} pairs), `columns`, and `source` (the primary
   column's data origin — e.g. `"Active Ledger + Xero"`, `"Excel"`). Carry the team and source —
   downstream skills need assignee defaults, a signatory, and where the numbers came from
   without a re-fetch.

## Notes

- Conventions (ids opaque, reset behaviour): `wp-ref-conventions`.
- When the user's reference already contains a binder id, still run `active-workpapers-binders-get` and
  emit a full `BinderContext` — downstream skills validate it.
- Skill, not agent: few calls, small output, often interactive.
