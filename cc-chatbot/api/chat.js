// api/chat.js
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

// Cache the parsed CSV data
let cachedResources = null;

const loadResources = () => {
  if (cachedResources) return cachedResources;
  
  try {
    // Path to CSV in public folder
    const csvPath = path.join(process.cwd(), 'public', 'converted.csv');
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });
    cachedResources = parsed.data;
    console.log(`Loaded ${cachedResources.length} resources from CSV`);
    return cachedResources;
  } catch (error) {
    console.error('Error loading CSV:', error);
    return [];
  }
};

const createResourceContext = (resourcesData) => {
  const sampleResources = resourcesData.slice(0, 5).map(r => ({
    name: r['Name of Organization'],
    services: r['4. What digital inclusion service(s) does your entity/organization provide to individuals? Please select all that apply.'],
    counties: r['6. Please indicate all the counties in which you provide services.'],
    city: r['Organization Address: City'],
    phone: r['Business Phone No'],
    website: r['Webpage'],
  }));

  return `You are Toni, a helpful assistant that helps people find digital equity resources in California. You have access to a database of ${resourcesData.length} organizations providing digital inclusion services.

Available services include: Digital literacy & skills training, Public Wi-Fi, Computer centers, Free/Low-cost devices, Free/Low-cost hotspots, Online educational resources, Workforce development resources, Digital navigation, and more.

Here are a few example resources from the database:
${JSON.stringify(sampleResources, null, 2)}

When answering questions:
1. Search through the resources to find relevant matches
2. Provide specific organization names, contact info, and services
3. Be conversational and helpful
4. If you can't find exact matches, suggest similar options
5. Keep responses concise but informative

Remember: You can only recommend organizations that are actually in the database. Always provide accurate contact information.`;
};

const searchResources = (query, resourcesData) => {
  const lowerQuery = query.toLowerCase();
  
  return resourcesData.filter(resource => {
    const searchableText = [
      resource['Name of Organization'],
      resource['4. What digital inclusion service(s) does your entity/organization provide to individuals? Please select all that apply.'],
      resource['6. Please indicate all the counties in which you provide services.'],
      resource['Organization Address: City'],
      resource['Type of Organization'],
    ].join(' ').toLowerCase();
    
    return searchableText.includes(lowerQuery);
  }).slice(0, 10);
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    const userMessage = messages[messages.length - 1].content;

    // Load resources
    const resourcesData = loadResources();

    // Search for relevant resources
    const relevantResources = searchResources(userMessage, resourcesData);
    
    // Build context with relevant resources
    let resourceContext = '';
    if (relevantResources.length > 0) {
      resourceContext = '\n\nRelevant resources found:\n' + relevantResources.map((r, i) => 
        `${i + 1}. ${r['Name of Organization']}
   - Services: ${r['4. What digital inclusion service(s) does your entity/organization provide to individuals? Please select all that apply.']}
   - Location: ${r['Organization Address: City']}, ${r['Organization Address: State']}
   - Counties served: ${r['6. Please indicate all the counties in which you provide services.']}
   - Phone: ${r['Business Phone No']}
   - Website: ${r['Webpage']}
   - Free: ${r['9. Does your entity/organization charge for its services?']}`
      ).join('\n\n');
    }

    const systemPrompt = createResourceContext(resourcesData) + resourceContext;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    res.status(200).json({ message: data.content[0].text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}