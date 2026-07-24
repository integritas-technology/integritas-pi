// Closed-world catalog for the Minima RPC console. Nothing runs unless it is both listed
// here AND enabled in the admin whitelist (backend/src/features/minima/minima-console.service.ts).
//
// Classification rule: defaultEnabled=true only for commands with no side effects ("read").
// Everything that can mutate funds, chain state, config, network, or the wallet defaults
// to disabled ("write"). vault/sendfrom/signfrom/createfrom/postfrom/createtokenfrom are
// excluded entirely because they take or expose a raw wallet private key; decryptbackup is
// excluded because it can turn an encrypted backup into plaintext seed/key material; keys
// and quit are excluded pending further review (keys' key-listing scope, quit's node-halt
// blast radius). None of the excluded commands can be enabled via the whitelist API — they
// simply have no catalog entry to reference.

// Kept in sync with the exclusions described in the file header comment — used only to give
// a clearer "permanently excluded" error message than a bare "unknown command" would.
export const excludedConsoleCommandVerbs = [
  "vault",
  "sendfrom",
  "signfrom",
  "createfrom",
  "postfrom",
  "createtokenfrom",
  "decryptbackup",
  "keys",
  "quit"
] as const;

export type ConsoleDispatch = "passthrough" | "megammrsync-resync" | "peers-add";

export type ConsoleCommandEntry = {
  key: string;
  verb: string;
  label: string;
  kind: "read" | "write";
  defaultEnabled: boolean;
  dispatch: ConsoleDispatch;
  match?: (rawInput: string) => boolean;
};

function read(verb: string, label: string): ConsoleCommandEntry {
  return { key: verb, verb, label, kind: "read", defaultEnabled: true, dispatch: "passthrough" };
}

function write(verb: string, label: string): ConsoleCommandEntry {
  return { key: verb, verb, label, kind: "write", defaultEnabled: false, dispatch: "passthrough" };
}

export const minimaConsoleCatalog: ConsoleCommandEntry[] = [
  // Special dispatch entries go first for verbs they share with another entry, so the
  // lookup in minima-console.service.ts (first entry whose match() succeeds) resolves the
  // specific sub-action before falling back to the generic/bare entry for that verb.
  {
    key: "peers.add",
    verb: "peers",
    label: "Add peers",
    kind: "write",
    defaultEnabled: false,
    dispatch: "peers-add",
    match: (rawInput) => /action:addpeers/i.test(rawInput)
  },
  read("peers", "List connected peers"),
  {
    key: "megammrsync.resync",
    verb: "megammrsync",
    label: "Resync from a MegaMMR node",
    kind: "write",
    defaultEnabled: false,
    dispatch: "megammrsync-resync"
  },

  // Read-only, default enabled.
  read("help", "Show help"),
  read("whitepaper", "Print the Minima white paper"),
  read("status", "Node status"),
  read("block", "Current top block"),
  read("scanchain", "Scan chain transaction data"),
  read("printtree", "Print blockchain tree"),
  read("burn", "Burn metrics"),
  read("trace", "Trace engine message stacks"),
  read("hashtest", "Hashing speed test"),
  read("timemilli", "Current time in milliseconds"),
  read("checkaddress", "Validate an address"),
  read("history", "Search relevant TxPoW history"),
  read("txpow", "Search TxPoW records"),
  read("coins", "Search coins"),
  read("tokens", "List, import, or export tokens"),
  read("getaddress", "Get a default address"),
  read("sendview", "View a transaction"),
  read("balance", "Wallet balance"),
  read("tokenvalidate", "Validate a token"),
  read("hash", "Hash data"),
  read("random", "Generate random data"),
  read("convert", "Convert between data formats"),
  read("maths", "Run MiniNumber maths"),
  read("scripts", "Search scripts and addresses"),
  read("tutorial", "KISSVM scripting tutorial"),
  read("mmrcreate", "Create an MMR tree"),
  read("mmrproof", "Check an MMR proof"),
  read("coincheck", "Check a coin exists"),
  read("cointrack", "Track or untrack a coin"),
  read("verify", "Verify a signature"),
  read("txnlist", "List custom transactions"),
  read("txncheck", "Show transaction details"),
  read("txnexport", "Export a transaction"),
  read("txnview", "View a transaction as JSON"),
  read("network", "Network status"),
  read("maxima", "Maxima details"),
  read("maxcontacts", "Manage Maxima contacts"),
  read("maxverify", "Verify a Maxima signature"),
  read("checkpending", "Check pending command status"),
  read("checkmode", "Check READ/WRITE mode"),
  read("checkrestore", "Check restore status"),

  // Write / mutating, default disabled.
  write("logs", "Enable subsystem logs"),
  write("newaddress", "Create a new address"),
  write("send", "Send Minima or tokens"),
  write("sendpoll", "Poll a queued send"),
  write("sendnosign", "Create an unsigned send transaction"),
  write("sendsign", "Sign a send transaction"),
  write("sendpost", "Post a signed send transaction"),
  write("multisig", "Create a multisig coin"),
  write("sphincs", "SPHINCS signature functions"),
  write("rawtxnfrom", "Create a raw unsigned transaction"),
  write("tokencreate", "Create a token"),
  write("consolidate", "Consolidate coins"),
  write("newscript", "Add a custom script"),
  write("runscript", "Run a script"),
  write("removescript", "Remove a script"),
  write("coinimport", "Import a coin"),
  write("coinexport", "Export a coin"),
  write("coinnotify", "Watch a coin address"),
  write("sign", "Sign data with a public key"),
  write("txncreate", "Create a transaction"),
  write("txnauto", "Auto-create a transaction"),
  write("txnaddamount", "Add inputs for an amount"),
  write("txnbasics", "Set MMR proofs and scripts on a transaction"),
  write("txndelete", "Delete a custom transaction"),
  write("txninput", "Add a coin input to a transaction"),
  write("txnoutput", "Add an output to a transaction"),
  write("txnstate", "Set a transaction state variable"),
  write("txnscript", "Add scripts to a transaction"),
  write("txnmmr", "Add MMR proofs to a transaction"),
  write("txnsign", "Sign a transaction"),
  write("txnclear", "Clear transaction witness data"),
  write("txnpost", "Post a transaction"),
  write("txnimport", "Import a transaction"),
  write("txnmine", "Mine a transaction"),
  write("txnminepost", "Post a pre-mined transaction"),
  write("maxextra", "Extra Maxima functions"),
  write("maxcreate", "Create a Maxima RSA key pair"),
  write("maxsign", "Sign data with a Maxima key"),
  write("message", "Send a message to a peer"),
  write("connect", "Connect to a network host"),
  write("disconnect", "Disconnect from a host"),
  write("rpc", "Enable or disable RPC"),
  write("webhooks", "Manage webhooks"),
  write("mds", "MiniDAPP system management"),
  write("backup", "Backup the system"),
  write("restore", "Restore the system"),
  write("restoresync", "Restore and archive-sync"),
  write("reset", "Reset using an archive backup"),
  write("archive", "Resync chain from archive"),
  write("megammr", "MegaMMR info, import, or export"),
  write("mysql", "Store/resync archive in MySQL"),
  write("mysqlcoins", "Search a coins DB from a MySQL archive")
];
