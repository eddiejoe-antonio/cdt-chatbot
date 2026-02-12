// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Load and parse CSV on startup
let resourcesData = [];
const csvPath = './public/converted.csv'; // Adjust path as needed

try {
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  resourcesData = parsed.data;
  console.log(`Loaded ${resourcesData.length} resources from CSV`);
} catch (error) {
  console.error('Error loading CSV:', error);
}

// Create a summary of the CSV data for the system prompt
const createResourceContext = () => {
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

// Search function to find relevant resources
const searchResources = (query) => {
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
  }).slice(0, 10); // Return top 10 matches
};

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const userMessage = messages[messages.length - 1].content;

    // Search for relevant resources based on user query
    const relevantResources = searchResources(userMessage);
    
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

    // Create system prompt with CSV context
    const systemPrompt = createResourceContext() + resourceContext;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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

    res.json({ message: data.content[0].text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});