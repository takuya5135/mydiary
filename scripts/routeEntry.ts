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
import { getGeminiModel, MODELS } from '../src/lib/ai/gemini';

const KNOWLEDGE_COLLECTION = 'knowledge_nodes';

async function getCategories() {
  const snapshot = await adminDb!.collection(KNOWLEDGE_COLLECTION).where('type', '==', 'category').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getClusters(parentId: string) {
  const snapshot = await adminDb!.collection(KNOWLEDGE_COLLECTION)
    .where('type', '==', 'cluster')
    .where('parentId', '==', parentId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function routeEntry(diaryText: string) {
  console.log(`\n📝 Input Diary Text:\n"${diaryText}"\n`);
  
  // Step 1: Predict Category
  console.log('🔍 Step 1: Determining the best Category (Level 1)...');
  const categories = await getCategories();
  
  const categoryPrompt = `
You are an expert AI classifying diary entries into predefined categories.
Analyze the following diary text and choose the most appropriate category ID.
Output your choice strictly as a JSON object with a single key "categoryId" containing the ID of the chosen category.

[Diary Text]
${diaryText}

[Available Categories]
${categories.map(c => `- ID: ${c.id}, Title: ${c.title}, Summary: ${c.summary}`).join('\n')}
`;

  const model = getGeminiModel(MODELS.MAIN);
  
  const catResult = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: categoryPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });
  
  const catResponseText = catResult.response.text();
  const catResultObj = JSON.parse(catResponseText);
  const selectedCategoryId = catResultObj.categoryId;
  
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  console.log(`✅ Selected Category: ${selectedCategory?.title || selectedCategoryId}`);

  if (!selectedCategory) {
     console.error('Invalid category selected.');
     return;
  }

  // Step 2: Predict Cluster
  console.log('\n🔍 Step 2: Determining the best Cluster (Level 2)...');
  const clusters = await getClusters(selectedCategoryId);
  
  const clusterPrompt = `
You are an expert AI classifying diary entries into predefined clusters within a specific category.
Analyze the following diary text and choose the most appropriate cluster ID from the given list.
Output your choice strictly as a JSON object with a single key "clusterId" containing the ID of the chosen cluster.

[Diary Text]
${diaryText}

[Available Clusters]
${clusters.map(c => `- ID: ${c.id}, Title: ${c.title}, Summary: ${c.summary}`).join('\n')}
`;

  const clusterResult = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: clusterPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const clusterResponseText = clusterResult.response.text();
  const clusterResultObj = JSON.parse(clusterResponseText);
  const selectedClusterId = clusterResultObj.clusterId;

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  console.log(`✅ Selected Cluster: ${selectedCluster?.title || selectedClusterId}`);
  
  console.log(`\n🎉 Routing Complete! Target Cluster ID: [${selectedClusterId}]`);
}

async function run() {
  if (!adminDb) {
    console.error('Failed to initialize adminDb.');
    process.exit(1);
  }

  const testText1 = "今日はセイワ運輸の遅延対応に追われた。姫路への在庫移動を手配し、なんとか事なきを得たが、物流の脆弱性を改めて痛感した。";
  await routeEntry(testText1);

  console.log("--------------------------------------------------");

  const testText2 = "みさちゃんと退職プランについて相談した。コンプライアンス意識の低さがやはりどうしても気になり、失業保険の受給計画も立て始めた。";
  await routeEntry(testText2);

  process.exit(0);
}

run();
