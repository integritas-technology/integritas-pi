import React, { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BellRing,
  ChevronRight,
  CircleCheck,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  FileClock,
  Gauge,
  HardDrive,
  KeyRound,
  Layers3,
  LineChart,
  ListTree,
  LockKeyhole,
  RadioTower,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wallet,
  Zap,
} from 'lucide-react';

type Tone = 'neutral' | 'good' | 'warn' | 'future';
type NavId =
  | 'dashboard'
  | 'setup'
  | 'node'
  | 'wallet'
  | 'integritas'
  | 'data'
  | 'automation'
  | 'diagnostics'
  | 'marketplace';
type IconItem = { title: string; text: string; icon: LucideIcon };
type NavItem = { id: NavId; label: string; icon: LucideIcon; badge?: string };

const nav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'setup', label: 'Setup', icon: Settings },
  { id: 'node', label: 'Minima Core', icon: RadioTower },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'integritas', label: 'Integritas', icon: ShieldCheck },
  { id: 'data', label: 'Data Sources', icon: Database },
  { id: 'automation', label: 'Automation', icon: BellRing },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: LineChart,
    badge: 'V2 Preview',
  },
];

const metrics = [
  {
    label: 'Node status',
    value: 'Running',
    helper: 'Minima node',
    icon: RadioTower,
  },
  {
    label: 'Wallet balance',
    value: '1,248 MINIMA',
    helper: 'Primary Pi wallet',
    icon: Wallet,
  },
  {
    label: 'Integritas API',
    value: 'Connected',
    helper: 'Last attestation 2 mins ago',
    icon: Cloud,
  },
  {
    label: 'Active triggers',
    value: '7',
    helper: '4 token events, 3 data events',
    icon: BellRing,
  },
];

const dataValueFlow: IconItem[] = [
  {
    title: 'Connect data',
    text: 'Sensor, file, API, webhook, or device log',
    icon: Database,
  },
  {
    title: 'Prove data',
    text: 'Integritas timestamp, integrity check, and provenance',
    icon: ShieldCheck,
  },
  {
    title: 'Trigger action',
    text: 'Run workflows from data, proofs, or token events',
    icon: Zap,
  },
  {
    title: 'Settle value',
    text: 'Wallet payments, token access, and future marketplace revenue',
    icon: Wallet,
  },
];

const quickActions: IconItem[] = [
  {
    title: 'Set up node',
    text: 'Start and monitor the local Minima node',
    icon: RadioTower,
  },
  {
    title: 'Create wallet',
    text: 'Create or import a wallet for payments and tokens',
    icon: Wallet,
  },
  {
    title: 'Connect data',
    text: 'Bring sensor, file, API, or device data into the workbench',
    icon: Database,
  },
  {
    title: 'Create proof',
    text: 'Verify local data with Integritas timestamping',
    icon: FileClock,
  },
  {
    title: 'Add automation',
    text: 'Trigger actions from tokens, data, or proofs',
    icon: Zap,
  },
  {
    title: 'Check diagnostics',
    text: 'Review node, wallet, API, and automation health',
    icon: Activity,
  },
];

const buildFlow = [
  [
    'Deploy Edge Stack',
    'Install the Raspberry Pi Edition bundle and open Edge Workbench.',
  ],
  [
    'Create wallet',
    'Create or import a Minima wallet for payments, tokens, and future marketplace revenue.',
  ],
  [
    'Connect data',
    'Bring in sensor streams, device logs, local files, or APIs.',
  ],
  [
    'Verify with Integritas',
    'Timestamp and attest selected data so it can be trusted.',
  ],
  [
    'Automate events',
    'Trigger actions when payments, tokens, data, or proofs change.',
  ],
  [
    'Build the use case',
    'Combine node, wallet, data, proof, and automation tools into a working edge workflow.',
  ],
];

const setupSteps = [
  [
    'Install package',
    'Confirm the Minima Edge Stack Pi Edition bundle is installed and running as a local service.',
  ],
  [
    'Open dashboard',
    'Access Edge Workbench from a browser on the local network.',
  ],
  [
    'Secure access',
    'Set password, local access rules, API keys, and backup options.',
  ],
  [
    'Connect services',
    'Configure Minima node, wallet, Integritas API, and local data inputs.',
  ],
];

const nodeStats = [
  { title: 'Minima', text: 'Running', icon: Layers3 },
  { title: 'Sync status', text: 'Synced', icon: RefreshCcw },
  { title: 'Local storage', text: '18.4 GB used', icon: HardDrive },
];

const walletActions = [
  { title: 'Create wallet', icon: KeyRound },
  { title: 'Import wallet', icon: LockKeyhole },
  { title: 'Generate address', icon: Code2 },
  { title: 'Export backup', icon: HardDrive },
  { title: 'Send payment', icon: Send },
  { title: 'Create token', icon: Sparkles },
];

const tokenEvents = [
  ['Payment received', 'wallet:edge-gateway-01', 'Start data upload', 'Active'],
  [
    'Access token detected',
    'token:DEVICE_ACCESS',
    'Unlock sensor feed',
    'Active',
  ],
  [
    'Attestation token minted',
    'token:ATTESTATION',
    'Verify sensor feed',
    'Draft',
  ],
];

const logs = [
  ['Transaction log', 'Token sent to mx03...9af2', '12:41:08', 'Confirmed'],
  [
    'Integritas API log',
    'Attestation created for sensor_batch_782.csv',
    '12:38:44',
    'Success',
  ],
  [
    'Trigger history',
    'Payment listener triggered webhook action',
    '12:36:19',
    'Executed',
  ],
];

const dataSources: IconItem[] = [
  {
    title: 'Sensor stream',
    text: 'MQTT, serial, GPIO, or local endpoint',
    icon: Activity,
  },
  {
    title: 'File watcher',
    text: 'Watch a local folder and attest new files',
    icon: ListTree,
  },
  {
    title: 'Local API',
    text: 'Pull data from an internal Pi service',
    icon: Code2,
  },
  {
    title: 'Device logs',
    text: 'Capture machine and application logs',
    icon: TerminalSquare,
  },
  {
    title: 'Manual upload',
    text: 'Upload a file for immediate proof creation',
    icon: FileClock,
  },
  {
    title: 'Webhook input',
    text: 'Receive external events into the Pi',
    icon: ExternalLink,
  },
];

const automationCards = [
  ['Token received', 'Start process'],
  ['Data threshold', 'Create proof'],
  ['Proof created', 'Mint token'],
  ['Payment received', 'Release data'],
];

const listings = [
  [
    'London air quality sensor feed',
    'Environmental',
    'Pi Gateway SW1V',
    'Integritas verified',
    '18 MINIMA / day',
    '42 buyers',
    '756 MINIMA',
    'Live stream',
  ],
  [
    'Cold chain temperature logs',
    'Supply chain',
    'Warehouse Pi Node 04',
    'Integritas verified',
    '120 MINIMA / dataset',
    '8 buyers',
    '960 MINIMA',
    'Updated hourly',
  ],
  [
    'EV charger uptime telemetry',
    'Mobility',
    'Edge Gateway Fleet A',
    'Integritas verified',
    '32 MINIMA / week',
    '19 buyers',
    '608 MINIMA',
    'Updated every 5 mins',
  ],
  [
    'Raspberry Pi weather station archive',
    'Climate',
    'Community Sensor Mesh',
    'Pending review',
    '75 MINIMA / dataset',
    '3 buyers watching',
    '0 MINIMA',
    'Daily batch',
  ],
];

const demandSignals = [
  ['Air quality', 'High', 'Buyers requesting live urban feeds'],
  ['Industrial uptime', 'Medium', 'Recurring demand from asset operators'],
  ['Cold chain', 'High', 'Premium for timestamped compliance logs'],
];

const purchases = [
  [
    'Research buyer',
    'London air quality sensor feed',
    '18 MINIMA',
    '12:44',
    'Paid',
  ],
  [
    'Logistics buyer',
    'Cold chain temperature logs',
    '120 MINIMA',
    '12:39',
    'Settled',
  ],
  [
    'Mobility buyer',
    'EV charger uptime telemetry',
    '32 MINIMA',
    '12:33',
    'Paid',
  ],
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function runSanityChecks() {
  console.assert(
    nav.some((item) => item.id === 'wallet'),
    'Wallet nav item should exist',
  );
  console.assert(
    !nav.some((item) => item.id === 'marketplace'),
    'Marketplace nav item should not exist',
  );
  console.assert(
    nav.some((item) => item.badge === 'V2 Preview'),
    'Marketplace should have V2 Preview badge',
  );
  console.assert(
    dataValueFlow.length === 4,
    'Data-to-value flow should have 4 steps',
  );
  console.assert(
    dataValueFlow.map((step) => step.title).join(' > ') ===
      'Connect data > Prove data > Trigger action > Settle value',
    'Data-to-value order changed',
  );
  console.assert(listings.length > 0, 'Marketplace listings should exist');
  console.assert(
    tokenEvents.every(([event, source, action]) => event && source && action),
    'Token events should be complete',
  );
}

if (typeof window !== 'undefined') runSanityChecks();

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        tone === 'neutral' && 'bg-slate-100 text-slate-700',
        tone === 'good' && 'bg-emerald-100 text-emerald-700',
        tone === 'warn' && 'bg-amber-100 text-amber-700',
        tone === 'future' && 'bg-violet-100 text-violet-700',
      )}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end'>
      <div>
        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
          {eyebrow}
        </p>
        <h2 className='mt-2 text-2xl font-semibold tracking-tight text-slate-950'>
          {title}
        </h2>
        {desc && (
          <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-600'>
            {desc}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function IconGrid({
  items,
  cols = 'xl:grid-cols-3',
}: {
  items: IconItem[];
  cols?: string;
}) {
  return (
    <div className={cx('grid gap-4 md:grid-cols-2', cols)}>
      {items.map(({ title, text, icon: Icon }) => (
        <Card
          key={title}
          className='p-5 transition hover:-translate-y-0.5 hover:shadow-md'
        >
          <Icon className='text-slate-700' size={24} />
          <h3 className='mt-4 font-semibold text-slate-950'>{title}</h3>
          <p className='mt-1 text-sm leading-6 text-slate-500'>{text}</p>
        </Card>
      ))}
    </div>
  );
}

function Metrics() {
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
      {metrics.map(({ label, value, helper, icon: Icon }) => (
        <Card key={label} className='rounded-2xl p-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-sm text-slate-500'>{label}</p>
              <h3 className='mt-2 text-2xl font-semibold tracking-tight text-slate-950'>
                {value}
              </h3>
              <p className='mt-1 text-sm text-slate-500'>{helper}</p>
            </div>
            <div className='rounded-2xl bg-slate-100 p-3 text-slate-700'>
              <Icon size={22} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function FlowList({ items }: { items: string[][] }) {
  return (
    <div className='space-y-3'>
      {items.map(([title, text], index) => (
        <div key={title} className='flex gap-4 rounded-2xl bg-slate-50 p-4'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white'>
            {index + 1}
          </div>
          <div>
            <p className='font-semibold text-slate-950'>{title}</p>
            <p className='mt-1 text-sm leading-6 text-slate-600'>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataToValuePanel() {
  return (
    <div className='relative z-10 rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur'>
      <p className='text-sm font-medium text-slate-300'>Use case builder</p>
      <h3 className='mt-2 text-xl font-semibold text-white'>Data to value</h3>
      <p className='mt-2 text-sm leading-6 text-slate-300'>
        Connect. Prove. Trigger. Settle.
      </p>
      <div className='mt-4 space-y-3'>
        {dataValueFlow.map(({ title, text, icon: Icon }, index) => (
          <div key={title} className='rounded-2xl bg-white/10 px-4 py-3'>
            <div className='flex items-start gap-3'>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white'>
                <Icon size={18} />
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-semibold text-slate-400'>
                    0{index + 1}
                  </span>
                  <p className='text-sm font-semibold text-white'>{title}</p>
                </div>
                <p className='mt-1 text-xs leading-5 text-slate-300'>{text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className='space-y-8'>
      <section className='overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm'>
        <div className='relative grid gap-8 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8'>
          <div className='absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl' />
          <div className='absolute bottom-0 right-24 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl' />
          <div className='relative z-10'>
            <div className='flex flex-wrap items-center gap-2'>
              <Pill>Pi Edition</Pill>
              <Pill>Edge Workbench</Pill>
              <Pill>Minima Core only</Pill>
            </div>
            <h1 className='mt-5 max-w-4xl text-4xl font-semibold tracking-tight lg:text-5xl'>
              Minima Edge Workbench
            </h1>
            <p className='mt-4 max-w-3xl text-base leading-7 text-slate-300'>
              Turn a Raspberry Pi into a Minima-powered edge gateway. Run a
              node, manage wallet and token workflows, verify local data with
              Integritas, and automate trusted edge events from a simple browser
              UI.
            </p>
            <div className='mt-6 flex flex-wrap gap-3'>
              <button className='inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-slate-100'>
                Start setup <ChevronRight size={17} />
              </button>
              <button className='inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10'>
                View build flow <ExternalLink size={17} />
              </button>
            </div>
          </div>
          <DataToValuePanel />
        </div>
      </section>

      <Metrics />

      <section>
        <Section
          eyebrow='Core tools'
          title='Everything needed to build trusted edge workflows'
          desc='Node, wallet, data, proof, automation, and diagnostics stay close together so builders can move from setup to a real use case quickly.'
        />
        <IconGrid items={quickActions} />
      </section>

      <section className='grid gap-6 lg:grid-cols-[0.9fr_1.1fr]'>
        <Card>
          <Section
            eyebrow='Build flow'
            title='From setup to trusted edge workflow'
            desc='Each step has one job: deploy, connect, prove, automate, then build.'
          />
          <FlowList items={buildFlow} />
        </Card>
        <Card>
          <Section
            eyebrow='Live activity'
            title='Events, attestations, and actions'
            desc='A clear activity layer helps users understand what the Pi is doing in the background.'
          />
          <LogRows rows={logs} />
        </Card>
      </section>
    </div>
  );
}

function Setup() {
  return (
    <Page
      eyebrow='Setup'
      title='Guided setup'
      desc='Install the Pi Edition, secure access, and connect the services needed to start building.'
    >
      <div className='grid gap-4 lg:grid-cols-2'>
        {setupSteps.map(([title, text]) => (
          <TextCard key={title} title={title} text={text} />
        ))}
      </div>
    </Page>
  );
}

function Node() {
  return (
    <Page
      eyebrow='Minima node'
      title='Run the Minima node'
      desc='Start, monitor, and manage the Minima Core node running on the Raspberry Pi Edition.'
      action={
        <button className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
          Restart node
        </button>
      }
    >
      <IconGrid items={nodeStats} cols='lg:grid-cols-3' />
      <Card>
        <h3 className='text-lg font-semibold text-slate-950'>Node health</h3>
        <StatGrid
          items={[
            ['CPU load', '22%'],
            ['Memory usage', '1.2 GB'],
            ['Peer connections', '12'],
            ['Last block', '12 seconds ago'],
          ]}
        />
      </Card>
    </Page>
  );
}

function WalletPage() {
  return (
    <Page
      eyebrow='Wallet'
      title='Wallet and tokens'
      desc='Manage wallet, payments, addresses, token creation, token transfers, and token-based events in one place.'
      action={
        <button className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
          Send payment
        </button>
      }
    >
      <section className='grid gap-6 lg:grid-cols-[0.8fr_1.2fr]'>
        <Card className='bg-slate-950 text-white'>
          <div className='flex items-center justify-between'>
            <Wallet size={28} />
            <Pill>Primary wallet</Pill>
          </div>
          <p className='mt-8 text-sm text-slate-400'>Available balance</p>
          <h3 className='mt-2 text-4xl font-semibold tracking-tight'>
            1,248 MINIMA
          </h3>
          <p className='mt-4 break-all rounded-2xl bg-white/10 p-3 text-sm text-slate-300'>
            mx03e7f...bb91a9
          </p>
        </Card>
        <Card>
          <h3 className='text-lg font-semibold text-slate-950'>
            Wallet actions
          </h3>
          <div className='mt-5 grid gap-3 md:grid-cols-2'>
            {walletActions.map(({ title, icon: Icon }) => (
              <button
                key={title}
                className='flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50'
              >
                <Icon size={20} className='text-slate-700' />
                <span className='font-medium text-slate-950'>{title}</span>
              </button>
            ))}
          </div>
        </Card>
      </section>
      <StatGrid
        items={[
          ['Created tokens', '14'],
          ['Token transfers', '183'],
          ['Listening rules', '7'],
        ]}
        cols='lg:grid-cols-3'
      />
      <Card>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold text-slate-950'>
              Token event rules
            </h3>
            <p className='mt-1 text-sm text-slate-500'>
              Listen for token events and trigger actions from the same Wallet
              workspace.
            </p>
          </div>
          <button className='text-sm font-semibold text-slate-950'>
            New listener
          </button>
        </div>
        <SimpleTable
          headers={['Event', 'Source', 'Action', 'Status']}
          rows={tokenEvents}
          badgeCol={3}
        />
      </Card>
    </Page>
  );
}

function Integritas() {
  return (
    <Page
      eyebrow='Integritas'
      title='Prove local data'
      desc='Use Integritas to timestamp data, verify integrity, and create a trusted proof trail.'
      action={
        <button className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
          Create attestation
        </button>
      }
    >
      <section className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-slate-950'>
              API connection
            </h3>
            <Pill tone='good'>Connected</Pill>
          </div>
          <KeyValueList
            items={[
              ['Endpoint', 'api.integritas.technology'],
              ['API key', '••••••••••••••••'],
              ['Last proof', 'sensor_batch_782.csv'],
              ['Last response', 'Success'],
            ]}
          />
        </Card>
        <Card>
          <h3 className='text-lg font-semibold text-slate-950'>
            Attestation builder
          </h3>
          <div className='mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center'>
            <FileClock className='mx-auto text-slate-500' size={28} />
            <p className='mt-3 font-medium text-slate-950'>
              Drop file, select data stream, or call local API
            </p>
            <p className='mt-1 text-sm text-slate-500'>
              CSV, JSON, image, sensor output, or machine log
            </p>
          </div>
          <button className='mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
            Generate timestamp proof
          </button>
        </Card>
      </section>
    </Page>
  );
}

function DataSources() {
  return (
    <Page
      eyebrow='Data connectors'
      title='Bring local data into the system'
      desc='Connect sensor streams, files, local APIs, device logs, or webhooks so data can be verified and used in workflows.'
      action={
        <button className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
          Add connector
        </button>
      }
    >
      <IconGrid items={dataSources} />
    </Page>
  );
}

function Automation() {
  return (
    <Page
      eyebrow='Automation'
      title='Trigger actions from data, proofs, or tokens'
      desc='Listen for events, apply conditions, and run local actions or external webhooks.'
      action={
        <button className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
          Create rule
        </button>
      }
    >
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {automationCards.map(([event, action]) => (
          <TextCard
            key={event}
            title={event}
            text={`Action: ${action}`}
            icon={BellRing}
          />
        ))}
      </div>
      <Card>
        <h3 className='text-lg font-semibold text-slate-950'>Rule builder</h3>
        <StatGrid
          items={[
            ['When', 'Token payment received'],
            ['Condition', 'Amount is greater than 10'],
            ['Then', 'Release attested dataset'],
          ]}
          cols='lg:grid-cols-3'
        />
      </Card>
    </Page>
  );
}

function Diagnostics() {
  const tabs = ['Transaction logs', 'Integritas API logs', 'Trigger history'];
  const [tab, setTab] = useState(tabs[0]);
  return (
    <Page
      eyebrow='Diagnostics'
      title='Understand what is happening'
      desc='Review node health, wallet activity, Integritas API logs, and automation history without dropping into the command line.'
    >
      <Card>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-wrap gap-2'>
            {tabs.map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={cx(
                  'rounded-full px-4 py-2 text-sm font-medium',
                  tab === item
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-700',
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className='flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500'>
            <Search size={16} /> Search logs
          </div>
        </div>
        <div className='mt-6'>
          <LogRows rows={logs.map((row) => [tab, row[1], row[2], row[3]])} />
        </div>
      </Card>
    </Page>
  );
}

function Marketplace() {
  return (
    <Page
      eyebrow='Marketplace — V2 Preview'
      title='Coming in V2: sell verified edge data'
      desc='A preview marketplace where Edge Stack users can publish Integritas-verified data products and receive buyer payments directly into their Minima wallet.'
      action={<Pill tone='future'>Coming in V2</Pill>}
    >
      <section className='overflow-hidden rounded-3xl border border-violet-200 bg-slate-950 text-white shadow-sm'>
        <div className='relative grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8'>
          <div className='absolute right-0 top-0 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl' />
          <div className='absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl' />
          <div className='relative z-10'>
            <div className='flex flex-wrap gap-2'>
              <Pill tone='future'>V2 Preview</Pill>
              <Pill>Integritas proofs required</Pill>
              <Pill>Wallet settlement</Pill>
            </div>
            <h3 className='mt-5 max-w-3xl text-3xl font-semibold tracking-tight lg:text-4xl'>
              Verified edge data becomes a sellable product
            </h3>
            <p className='mt-4 max-w-3xl text-sm leading-6 text-slate-300'>
              Connect a data source, create an Integritas proof, list the
              dataset, and settle access payments directly into the Minima
              wallet.
            </p>
            <div className='mt-6 grid gap-3 sm:grid-cols-3'>
              {[
                ['Listed datasets', '24'],
                ['Marketplace revenue', '2,324 MINIMA'],
                ['Proof coverage', '96%'],
              ].map(([label, value]) => (
                <div key={label} className='rounded-2xl bg-white/10 p-4'>
                  <p className='text-xs text-slate-400'>{label}</p>
                  <p className='mt-1 text-xl font-semibold text-white'>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className='relative z-10 rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur'>
            <p className='text-sm font-medium text-slate-300'>Seller wallet</p>
            <h4 className='mt-3 text-3xl font-semibold'>3,572 MINIMA</h4>
            <p className='mt-2 text-sm text-slate-400'>
              Revenue received from marketplace purchases
            </p>
            <KeyValueList
              dark
              items={[
                ['Today', '+170 MINIMA'],
                ['This week', '+684 MINIMA'],
                ['Pending settlement', '64 MINIMA'],
              ]}
            />
          </div>
        </div>
      </section>

      <section className='grid gap-6 xl:grid-cols-[1.4fr_0.6fr]'>
        <Card>
          <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h3 className='text-lg font-semibold text-slate-950'>
                Preview marketplace listings
              </h3>
              <p className='mt-1 text-sm text-slate-500'>
                Example verified data products that could be published from edge
                gateways.
              </p>
            </div>
            <button className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
              List new dataset
            </button>
          </div>
          <div className='grid gap-4 lg:grid-cols-2'>
            {listings.map(
              ([
                title,
                category,
                source,
                proof,
                price,
                buyers,
                revenue,
                freshness,
              ]) => (
                <ListingCard
                  key={title}
                  title={title}
                  category={category}
                  source={source}
                  proof={proof}
                  meta={[
                    ['Price', price],
                    ['Buyers', buyers],
                    ['Revenue', revenue],
                    ['Freshness', freshness],
                  ]}
                />
              ),
            )}
          </div>
        </Card>
        <div className='space-y-6'>
          <Card>
            <h3 className='text-lg font-semibold text-slate-950'>
              Demand signals
            </h3>
            <p className='mt-1 text-sm text-slate-500'>
              Marketplace prompts help users understand what data buyers want.
            </p>
            <div className='mt-5 space-y-3'>
              {demandSignals.map(([signal, demand, detail]) => (
                <div key={signal} className='rounded-2xl bg-slate-50 p-4'>
                  <div className='flex items-center justify-between gap-3'>
                    <p className='font-medium text-slate-950'>{signal}</p>
                    <Pill tone={demand === 'High' ? 'good' : 'neutral'}>
                      {demand}
                    </Pill>
                  </div>
                  <p className='mt-2 text-sm leading-6 text-slate-600'>
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className='text-lg font-semibold text-slate-950'>
              Listing rules
            </h3>
            <div className='mt-5 space-y-3'>
              {[
                'Require Integritas proof before publishing',
                'Set access price in MINIMA',
                'Release data after wallet payment',
                'Keep full audit trail for buyer and seller',
              ].map((rule) => (
                <div
                  key={rule}
                  className='flex gap-3 rounded-2xl bg-slate-50 p-4'
                >
                  <CircleCheck
                    className='mt-0.5 shrink-0 text-emerald-600'
                    size={18}
                  />
                  <p className='text-sm font-medium text-slate-800'>{rule}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className='grid gap-6 lg:grid-cols-[0.8fr_1.2fr]'>
        <Card>
          <h3 className='text-lg font-semibold text-slate-950'>Publish flow</h3>
          <div className='mt-5'>
            <FlowList
              items={[
                [
                  'Select attested data',
                  'Choose a live stream, batch file, or historical dataset from the Edge Workbench.',
                ],
                [
                  'Verify proof status',
                  'Confirm Integritas has created timestamp and integrity proofs.',
                ],
                [
                  'Set commercial terms',
                  'Define price, subscription type, access window, and usage rights.',
                ],
                [
                  'Publish to marketplace',
                  'Make the data discoverable and automate release after payment.',
                ],
              ]}
            />
          </div>
        </Card>
        <Card>
          <div className='mb-5 flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold text-slate-950'>
                Preview purchase activity
              </h3>
              <p className='mt-1 text-sm text-slate-500'>
                Example purchases that would settle into the Minima wallet.
              </p>
            </div>
            <Pill tone='future'>V2 Preview</Pill>
          </div>
          <SimpleTable
            headers={['Buyer', 'Data product', 'Amount', 'Time', 'Status']}
            rows={purchases}
            badgeCol={4}
          />
        </Card>
      </section>
    </Page>
  );
}

function Page({
  eyebrow,
  title,
  desc,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className='space-y-6'>
      <Section eyebrow={eyebrow} title={title} desc={desc} action={action} />
      {children}
    </div>
  );
}

function TextCard({
  title,
  text,
  icon: Icon,
}: {
  title: string;
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      {Icon && <Icon className='text-slate-700' size={24} />}
      <h3 className={cx('font-semibold text-slate-950', Icon && 'mt-4')}>
        {title}
      </h3>
      <p className='mt-2 text-sm leading-6 text-slate-600'>{text}</p>
    </Card>
  );
}

function StatGrid({
  items,
  cols = 'md:grid-cols-2',
}: {
  items: string[][];
  cols?: string;
}) {
  return (
    <div className={cx('mt-5 grid gap-4', cols)}>
      {items.map(([label, value]) => (
        <div key={label} className='rounded-2xl bg-slate-50 p-4'>
          <p className='text-sm text-slate-500'>{label}</p>
          <p className='mt-1 text-xl font-semibold text-slate-950'>{value}</p>
        </div>
      ))}
    </div>
  );
}

function KeyValueList({
  items,
  dark = false,
}: {
  items: string[][];
  dark?: boolean;
}) {
  return (
    <div className='mt-5 space-y-3'>
      {items.map(([label, value]) => (
        <div
          key={label}
          className={cx(
            'flex items-center justify-between rounded-2xl px-4 py-3',
            dark ? 'bg-white/10' : 'bg-slate-50',
          )}
        >
          <span
            className={cx(
              'text-sm',
              dark ? 'text-slate-300' : 'text-slate-500',
            )}
          >
            {label}
          </span>
          <span
            className={cx(
              'text-sm font-semibold',
              dark ? 'text-white' : 'text-slate-950',
            )}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function LogRows({ rows }: { rows: string[][] }) {
  return (
    <div className='space-y-3'>
      {rows.map(([type, detail, time, status]) => (
        <div
          key={`${type}-${time}`}
          className='flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4'
        >
          <div>
            <p className='text-sm font-semibold text-slate-950'>{type}</p>
            <p className='mt-1 text-sm text-slate-600'>{detail}</p>
          </div>
          <div className='text-right'>
            <p className='text-xs text-slate-500'>{time}</p>
            <p className='mt-1 text-sm font-medium text-slate-900'>{status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  badgeCol,
}: {
  headers: string[];
  rows: string[][];
  badgeCol?: number;
}) {
  return (
    <div className='overflow-hidden rounded-2xl border border-slate-200'>
      <table className='w-full text-left text-sm'>
        <thead className='bg-slate-50 text-slate-500'>
          <tr>
            {headers.map((header) => (
              <th key={header} className='px-4 py-3 font-medium'>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-slate-100'>
          {rows.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell, index) => (
                <td
                  key={`${cell}-${index}`}
                  className='px-4 py-4 text-slate-600'
                >
                  {index === 0 ? (
                    <span className='font-medium text-slate-950'>{cell}</span>
                  ) : index === badgeCol ? (
                    <Pill tone={cell === 'Draft' ? 'neutral' : 'good'}>
                      {cell}
                    </Pill>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListingCard({
  title,
  category,
  source,
  proof,
  meta,
}: {
  title: string;
  category: string;
  source: string;
  proof: string;
  meta: string[][];
}) {
  return (
    <div className='rounded-3xl border border-slate-200 bg-slate-50 p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <Pill tone={proof === 'Integritas verified' ? 'good' : 'warn'}>
            {proof}
          </Pill>
          <h4 className='mt-3 font-semibold text-slate-950'>{title}</h4>
          <p className='mt-1 text-sm text-slate-500'>{source}</p>
        </div>
        <Pill>{category}</Pill>
      </div>
      <div className='mt-5 grid gap-3 sm:grid-cols-2'>
        {meta.map(([label, value]) => (
          <div key={label} className='rounded-2xl bg-white p-3'>
            <p className='text-xs text-slate-500'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-slate-950'>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivePage({ active }: { active: NavId }) {
  const pages: Record<NavId, React.ReactNode> = {
    dashboard: <Dashboard />,
    setup: <Setup />,
    node: <Node />,
    wallet: <WalletPage />,
    integritas: <Integritas />,
    data: <DataSources />,
    automation: <Automation />,
    diagnostics: <Diagnostics />,
    marketplace: <Marketplace />,
  };
  return <>{pages[active]}</>;
}

export default function MinimaEdgeWorkbench() {
  const [active, setActive] = useState<NavId>('dashboard');
  const activeItem = useMemo(
    () => nav.find((item) => item.id === active) ?? nav[0],
    [active],
  );

  return (
    <div className='min-h-screen bg-slate-100 text-slate-950'>
      <div className='flex min-h-screen'>
        <aside className='hidden w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:block'>
          <div className='flex items-center gap-3 rounded-3xl bg-slate-950 p-4 text-white'>
            <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10'>
              <Layers3 size={24} />
            </div>
            <div>
              <p className='text-sm text-slate-300'>Minima Edge Stack</p>
              <h1 className='font-semibold'>Edge Workbench</h1>
            </div>
          </div>
          <nav className='mt-6 space-y-1'>
            {nav.map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cx(
                  'flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium transition',
                  active === id
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                )}
              >
                <span className='flex items-center gap-3'>
                  <Icon size={19} />
                  {label}
                </span>
                {badge && (
                  <span
                    className={cx(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      active === id
                        ? 'bg-white/15 text-white'
                        : 'bg-violet-100 text-violet-700',
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className='mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4'>
            <div className='flex items-center gap-2 text-sm font-semibold text-slate-950'>
              <ShieldCheck size={18} /> Edge gateway ready
            </div>
            <p className='mt-2 text-sm leading-6 text-slate-600'>
              A browser-first workbench for node, wallet, token, verified data,
              and automation workflows at the edge.
            </p>
          </div>
        </aside>

        <main className='flex-1 p-4 lg:p-8'>
          <header className='mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex items-center gap-3'>
              <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 lg:hidden'>
                <Layers3 size={22} />
              </div>
              <div>
                <p className='text-sm text-slate-500'>Current section</p>
                <h2 className='text-xl font-semibold tracking-tight text-slate-950'>
                  {activeItem.label}
                </h2>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Pill tone='good'>Node online</Pill>
              <Pill tone='good'>Wallet ready</Pill>
              <Pill tone='good'>Integritas connected</Pill>
            </div>
          </header>
          <div className='mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden'>
            {nav.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cx(
                  'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium',
                  active === id
                    ? 'bg-slate-950 text-white'
                    : 'bg-white text-slate-600',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <ActivePage active={active} />
        </main>
      </div>
    </div>
  );
}
