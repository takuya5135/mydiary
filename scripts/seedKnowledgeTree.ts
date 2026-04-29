import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// For local testing, we need to load .env.local if not loaded
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

import { adminDb } from '../src/lib/firebase/server-config';

// Define the KnowledgeNode structure
interface KnowledgeNode {
  id: string;
  title: string;
  summary: string;
  level: number;
  parentId: string | null;
  type: 'root' | 'category' | 'cluster';
  diaryIds: string[];
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

const KNOWLEDGE_COLLECTION = 'knowledge_nodes';

// Draft Data based on User Request
const nodesData: Omit<KnowledgeNode, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'root',
    title: 'INDEX.md',
    summary: 'JFSのガバナンス問題と退職に向けた戦略、および自律的開発基盤の確立',
    level: 0,
    parentId: null,
    type: 'root',
    diaryIds: [],
  },
  // Category 01
  {
    id: 'cat_01',
    title: '01_経営・法務・戦略 (Business & Strategy)',
    summary: 'JFSにおける法的リスク回避、ガバナンス不全への対応、およびセカンドキャリアの設計を司る。',
    level: 1,
    parentId: 'root',
    type: 'category',
    diaryIds: [],
  },
  {
    id: 'cluster_1_1',
    title: '裁判・契約リスク管理',
    summary: '古賀裁判の反論作成、小野弁護士との連携、委託契約書の問題抽出。',
    level: 2,
    parentId: 'cat_01',
    type: 'cluster',
    diaryIds: ['dummy_diary_01', 'dummy_diary_02'], // Example placeholders
  },
  {
    id: 'cluster_1_2',
    title: 'キャリア・ガバナンス設計',
    summary: '妻（みさちゃん）との退職プラン相談、コンプライアンス意識の欠如への警鐘、失業保険受給計画。',
    level: 2,
    parentId: 'cat_01',
    type: 'cluster',
    diaryIds: ['dummy_diary_03', 'dummy_diary_04'],
  },
  // Category 02
  {
    id: 'cat_02',
    title: '02_サプライチェーン・商品開発 (Supply Chain & Products)',
    summary: '鶏肉加工品の原料調達から、物流混乱の回避、販促会議、工場連携までを網羅する。',
    level: 1,
    parentId: 'root',
    type: 'category',
    diaryIds: [],
  },
  {
    id: 'cluster_2_1',
    title: '物流・在庫最適化',
    summary: 'セイワ運輸遅延への網羅的対応、姫路・高松への在庫移動、FAサクうまチキンの入荷拒否対応。',
    level: 2,
    parentId: 'cat_02',
    type: 'cluster',
    diaryIds: ['dummy_diary_05', 'dummy_diary_06'],
  },
  {
    id: 'cluster_2_2',
    title: '商品開発・販促戦略',
    summary: 'スチームチキンレッグ最終コンペ、炭火香るシリーズの欠品対策、販促ラベル在庫会議。',
    level: 2,
    parentId: 'cat_02',
    type: 'cluster',
    diaryIds: ['dummy_diary_07'],
  },
  // Category 03
  {
    id: 'cat_03',
    title: '03_技術・デジタル基盤 (Technology & Development)',
    summary: 'サイレントログインプロトコルを中心とした、AIエージェントによる自動化開発の知見。',
    level: 1,
    parentId: 'root',
    type: 'category',
    diaryIds: [],
  },
  {
    id: 'cluster_3_1',
    title: '自律的認証・開発',
    summary: 'Silent Authスキルの確立、Gemini 3 Pro/Flashの使い分け、Firebase Admin SDKの修正。',
    level: 2,
    parentId: 'cat_03',
    type: 'cluster',
    diaryIds: ['dummy_diary_08'],
  },
  {
    id: 'cluster_3_2',
    title: 'インフラ整備',
    summary: 'eo光Wi-Fi 6ルーター交換によるオンライン環境の安定化。',
    level: 2,
    parentId: 'cat_03',
    type: 'cluster',
    diaryIds: ['dummy_diary_09'],
  },
  // Category 04
  {
    id: 'cat_04',
    title: '04_家庭・健康・生活 (Life & Wellbeing)',
    summary: '家族のイベント、教育方針、およびランニングを通じた自己管理。',
    level: 1,
    parentId: 'root',
    type: 'category',
    diaryIds: [],
  },
  {
    id: 'cluster_4_1',
    title: '家族・教育',
    summary: 'GWの三重ドライブ計画、長女・次女の成長、三男の中学受験準備。',
    level: 2,
    parentId: 'cat_04',
    type: 'cluster',
    diaryIds: ['dummy_diary_10'],
  },
  {
    id: 'cluster_4_2',
    title: 'フィットネス・文化',
    summary: '10kmランニング（厚着と脱水の教訓）、映画『プレデター：バッドランズ』。',
    level: 2,
    parentId: 'cat_04',
    type: 'cluster',
    diaryIds: ['dummy_diary_11'],
  },
];

async function seedKnowledgeTree() {
  if (!adminDb) {
    console.error('Failed to initialize adminDb.');
    process.exit(1);
  }

  console.log('🌱 Seeding Knowledge Tree to Firestore...');
  const batch = adminDb.batch();

  nodesData.forEach((node) => {
    const docRef = adminDb.collection(KNOWLEDGE_COLLECTION).doc(node.id);
    const dataToSave: KnowledgeNode = {
      ...node,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.set(docRef, dataToSave, { merge: true }); // Use merge to prevent completely overriding existing data unexpectedly
  });

  try {
    await batch.commit();
    console.log(`✅ Successfully seeded ${nodesData.length} nodes to '${KNOWLEDGE_COLLECTION}' collection.`);
  } catch (error) {
    console.error('❌ Error seeding Knowledge Tree:', error);
  }
}

seedKnowledgeTree();
