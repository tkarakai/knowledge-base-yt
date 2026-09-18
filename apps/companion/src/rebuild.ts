import { Vault } from "@repo/kb";
import { SearchIndex } from "@repo/search";
import { scanForSearch } from "./index";
import { State } from "./state";
// Local operator CLI only rebuilds derived data; no listener or job recovery runs.
const vault = new Vault(process.env.KB_VAULT_PATH ?? "./vault");
await vault.init();
const state = new State(vault.root);
await state.load(false);
const index = new SearchIndex(await state.path("search.sqlite"), {
  enabled: state.settings.network.embeddings,
  config: state.settings.embeddings,
});
try {
  console.log(
    JSON.stringify({
      ...(await index.rebuild(await scanForSearch(vault))),
      retrieval: index.diagnostics,
    }),
  );
} finally {
  index.close();
}
