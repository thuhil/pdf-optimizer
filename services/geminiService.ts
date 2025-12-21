import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

// Helper to convert a URL (data: or blob:) to a GoogleGenAI Part object
const urlToGenerativePart = async (url: string) => {
    // If it's a data URL, we can extract directly
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
                // FileReader result is "data:mime;base64,data..."
                const base64Data = base64String.split(',')[1];
                resolve({
                    inlineData: {
                        data: base64Data,
                        mimeType: blob.type || 'image/jpeg' // Fallback if type is missing
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

export const getAutoCropSuggestion = async (imageUrl: string): Promise<{x: number, y: number, width: number, height: number} | null> => {
    try {
        const ai = getClient();
        const imagePart = await urlToGenerativePart(imageUrl);
        
        // Use gemini-3-flash-preview which supports JSON schema enforcement
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    imagePart,
                    { text: "Detect the main document/paper in this image. Return the bounding box coordinates where ymin, xmin, ymax, xmax are percentages (0-100) of the image dimensions." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        ymin: { type: Type.NUMBER, description: "Top edge percentage (0-100)" },
                        xmin: { type: Type.NUMBER, description: "Left edge percentage (0-100)" },
                        ymax: { type: Type.NUMBER, description: "Bottom edge percentage (0-100)" },
                        xmax: { type: Type.NUMBER, description: "Right edge percentage (0-100)" },
                    },
                    required: ["ymin", "xmin", "ymax", "xmax"],
                }
            }
        });

        const text = response.text;
        if (!text) return null;

        // With responseMimeType, text is guaranteed to be valid JSON
        const data = JSON.parse(text);
        
        // Validate expected keys
        if (typeof data.xmin !== 'number' || typeof data.ymin !== 'number') {
             console.warn("Invalid JSON structure returned", data);
             return null;
        }

        // Convert ymin/xmin/ymax/xmax to x, y, width, height format
        const width = data.xmax - data.xmin;
        const height = data.ymax - data.ymin;
        
        return {
            x: data.xmin,
            y: data.ymin,
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