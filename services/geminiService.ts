import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

// Helper to convert a URL (data: or blob:) to a GoogleGenAI Part object
const urlToGenerativePart = async (url: string) => {
    // If it's a data URL, extract directly
    if (url.startsWith('data:')) {
        const base64Data = url.split(',')[1];
        const mimeType = url.split(';')[0].split(':')[1];
        return {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        };
    }

    // If it's a blob URL or other fetchable URL, fetch and convert
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                const base64Data = base64String.split(',')[1];
                resolve({
                    inlineData: {
                        data: base64Data,
                        mimeType: blob.type || 'image/jpeg'
                    }
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting URL to part:", error);
        throw error;
    }
};

// Robust JSON extractor that handles markdown and trailing garbage
const parseJSONSafely = (text: string): any => {
    if (!text) return null;
    
    // 1. Remove Markdown code blocks with flexible whitespace handling
    let cleanText = text.replace(/```\s*json/gi, '').replace(/```/g, '').trim();

    // 2. Try direct parse first
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        // Continue to robust extraction
    }

    // 3. Find first JSON object using brace counting
    const firstOpen = cleanText.indexOf('{');
    if (firstOpen === -1) return null;

    let balance = 0;
    let endIndex = -1;

    for (let i = firstOpen; i < cleanText.length; i++) {
        if (cleanText[i] === '{') {
            balance++;
        } else if (cleanText[i] === '}') {
            balance--;
            if (balance === 0) {
                endIndex = i;
                break;
            }
        }
    }

    if (endIndex !== -1) {
        const jsonStr = cleanText.substring(firstOpen, endIndex + 1);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON parse failed even after extraction:", jsonStr);
            return null;
        }
    }
    
    return null;
};

export const getAutoCropSuggestion = async (imageUrl: string): Promise<{x: number, y: number, width: number, height: number} | null> => {
    try {
        const ai = getClient();
        const imagePart = await urlToGenerativePart(imageUrl);
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    imagePart,
                    { text: "Detect the main document/paper in this image. Return a JSON object with percentages for ymin, xmin, ymax, xmax (0-100)." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        ymin: { type: Type.NUMBER, description: "Top edge %" },
                        xmin: { type: Type.NUMBER, description: "Left edge %" },
                        ymax: { type: Type.NUMBER, description: "Bottom edge %" },
                        xmax: { type: Type.NUMBER, description: "Right edge %" },
                    },
                    required: ["ymin", "xmin", "ymax", "xmax"],
                }
            }
        });

        const data = parseJSONSafely(response.text || '');
        if (!data) return null;

        // Ensure valid coordinates
        const xmin = Math.max(0, data.xmin);
        const ymin = Math.max(0, data.ymin);
        const xmax = Math.min(100, data.xmax);
        const ymax = Math.min(100, data.ymax);
        
        const width = Math.max(1, xmax - xmin);
        const height = Math.max(1, ymax - ymin);
        
        return {
            x: xmin,
            y: ymin,
            width: width,
            height: height
        };

    } catch (error) {
        console.error("Gemini Auto-Crop Error:", error);
        return null;
    }
};

export const extractTextWithOCR = async (imageUrl: string): Promise<string> => {
    try {
        const ai = getClient();
        const imagePart = await urlToGenerativePart(imageUrl);

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    imagePart,
                    { text: "Extract all readable text from this document image. Return clean, formatted text." }
                ]
            }
        });

        return response.text || "No text detected.";
    } catch (error) {
        console.error("Gemini OCR Error:", error);
        return "Failed to extract text.";
    }
};

export const extractTableData = async (imageUrl: string): Promise<string> => {
    try {
        const ai = getClient();
        const imagePart = await urlToGenerativePart(imageUrl);

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    imagePart,
                    { text: "Identify any tables in this image. Extract the table data and return it in CSV format. No markdown blocks, just raw CSV text. If no tables found, return 'NO_TABLES'." }
                ]
            }
        });

        let text = response.text || "NO_TABLES";
        text = text.replace(/```csv/gi, '').replace(/```/g, '').trim();
        return text;
    } catch (error) {
        console.error("Gemini Table Extraction Error:", error);
        return "ERROR";
    }
};