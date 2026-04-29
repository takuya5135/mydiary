import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server-config';
import { getGeminiModel, MODELS } from '@/lib/ai/gemini';

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

export async function POST(request: Request) {
  try {
    const { userId, date, text } = await request.json();

    if (!userId || !date || !text || text.trim() === '') {
      return NextResponse.json({ error: 'Missing required fields or empty text' }, { status: 400 });
    }

    if (!adminDb) {
      console.error('[AutoRouting] adminDb not initialized');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    console.log(`[AutoRouting] Starting background routing for ${userId}_${date}...`);

    // Step 1: Predict Category
    const categories = await getCategories();
    if (categories.length === 0) {
       console.log('[AutoRouting] No categories found. Skipping routing.');
       return NextResponse.json({ message: 'No knowledge tree available' });
    }

    const categoryPrompt = `
You are an expert AI classifying diary entries into predefined categories.
Analyze the following diary text and choose the most appropriate category ID.
Output your choice strictly as a JSON object with a single key "categoryId" containing the ID of the chosen category.

[Diary Text]
${text}

[Available Categories]
${categories.map(c => `- ID: ${c.id}, Title: ${(c as any).title}, Summary: ${(c as any).summary}`).join('\n')}
`;

    const model = getGeminiModel(MODELS.MAIN);
    
    const catResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: categoryPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    
    const catResultObj = JSON.parse(catResult.response.text());
    const selectedCategoryId = catResultObj.categoryId;

    if (!selectedCategoryId || !categories.find(c => c.id === selectedCategoryId)) {
       console.log(`[AutoRouting] Failed to select a valid category. Selection: ${selectedCategoryId}`);
       return NextResponse.json({ message: 'Routing incomplete (Category)' });
    }

    // Step 2: Predict Cluster
    const clusters = await getClusters(selectedCategoryId);
    if (clusters.length === 0) {
       console.log(`[AutoRouting] No clusters found for category ${selectedCategoryId}. Skipping cluster routing.`);
       return NextResponse.json({ message: 'Routing incomplete (No clusters)' });
    }
    
    const clusterPrompt = `
You are an expert AI classifying diary entries into predefined clusters within a specific category.
Analyze the following diary text and choose the most appropriate cluster ID from the given list.
Output your choice strictly as a JSON object with a single key "clusterId" containing the ID of the chosen cluster.

[Diary Text]
${text}

[Available Clusters]
${clusters.map(c => `- ID: ${c.id}, Title: ${(c as any).title}, Summary: ${(c as any).summary}`).join('\n')}
`;

    const clusterResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: clusterPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const clusterResultObj = JSON.parse(clusterResult.response.text());
    const selectedClusterId = clusterResultObj.clusterId;

    if (!selectedClusterId || !clusters.find(c => c.id === selectedClusterId)) {
        console.log(`[AutoRouting] Failed to select a valid cluster. Selection: ${selectedClusterId}`);
        return NextResponse.json({ message: 'Routing incomplete (Cluster)' });
    }

    // Step 3: Update Firestore via Admin SDK
    // Note: adminDb doesn't have the FieldValue.serverTimestamp() directly on the instance, it's on the class. Let's omit updatedAt to avoid typing issues, or use admin from firebase-admin.
    // Actually, we can just let it save clusterId. The client saves updatedAt anyway.
    
    const entryId = `${userId}_${date}`;
    console.log(`[AutoRouting] Target Cluster: [${selectedClusterId}]. Saving to entry ${entryId}...`);
    
    await adminDb.collection('entries').doc(entryId).set({
      clusterId: selectedClusterId,
    }, { merge: true });

    console.log(`[AutoRouting] Successfully assigned ${entryId} to ${selectedClusterId}.`);

    return NextResponse.json({ success: true, clusterId: selectedClusterId });

  } catch (error) {
    console.error('[AutoRouting] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
