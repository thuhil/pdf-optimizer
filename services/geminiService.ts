import { GoogleGenAI, Type, Schema } from "@google/genai";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

// Converts a base64 string (dataURL) to the format Gemini expects
const base64ToPart = (base64Str: string) => {
    // Remove "data:image/jpeg;base64," prefix
    const base64Data = base64Str.split(',')[1];
    const mimeType = base64Str.split(';')[0].split(':')[1];
    return {
        inlineData: {
            data: base64Data,
            mimeType: mimeType
        }
    };
};

export const getAutoCropSuggestion = async (imageBase64: string): Promise<{x: number, y: number, width: number, height: number} | null> => {
    try {
        const ai = getClient();
        
        // Define schema for the coordinate return
        const responseSchema: Schema = {
             type: Type.OBJECT,
             properties: {
                 ymin: { type: Type.NUMBER, description: "Top edge percentage (0-100)" },
                 xmin: { type: Type.NUMBER, description: "Left edge percentage (0-100)" },
                 ymax: { type: Type.NUMBER, description: "Bottom edge percentage (0-100)" },
                 xmax: { type: Type.NUMBER, description: "Right edge percentage (0-100)" },
             },
             required: ["ymin", "xmin", "ymax", "xmax"],
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    base64ToPart(imageBase64),
                    { text: "Detect the main document or paper in this image. Return the bounding box coordinates as percentages (0-100) of the image dimensions. Ensure tight cropping around the paper content." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                systemInstruction: "You are a document scanner assistant. Analyze the image and find the corners of the paper document."
            }
        });

        const text = response.text;
        if (!text) return null;

        const data = JSON.parse(text);
        
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

export const extractTextWithOCR = async (imageBase64: string): Promise<string> => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    base64ToPart(imageBase64),
                    { text: "Extract all readable text from this document image. formatting it nicely." }
                ]
            }
        });

        return response.text || "No text detected.";
    } catch (error) {
        console.error("Gemini OCR Error:", error);
        return "Failed to extract text.";
    }
};
