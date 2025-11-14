import logoImage from "@assets/ZSPL-Logo-Only Name_1763102256187.png";

export default function ColorPreview() {
  const colorOptions = [
    { name: "Option 1: Matching Bronze/Copper", color: "#B87333", description: "Same warm metallic tone" },
    { name: "Option 2: Deep Navy Blue", color: "#1e3a5f", description: "Professional medical color" },
    { name: "Option 3: Dark Charcoal", color: "#2d3436", description: "Modern, sophisticated" },
    { name: "Option 4: Medical Teal", color: "#17a2b8", description: "Healthcare color" },
    { name: "Option 5: White", color: "#ffffff", description: "Clean, modern (on dark bg)" },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-8">NotesMateMD Color Options</h1>
        
        {colorOptions.map((option, index) => (
          <div key={index} className="border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">{option.name}</h2>
            <p className="text-sm text-muted-foreground">{option.description}</p>
            
            {/* Light background preview */}
            <div className="bg-white p-8 rounded border">
              <div className="flex items-center gap-3">
                <img src={logoImage} alt="zapurzaa" className="h-8" />
                <span 
                  className="text-2xl font-semibold"
                  style={{ color: option.color }}
                >
                  NotesMateMD
                </span>
              </div>
            </div>
            
            {/* Dark background preview (for white option) */}
            {option.color === "#ffffff" && (
              <div className="bg-gray-900 p-8 rounded border">
                <div className="flex items-center gap-3">
                  <img src={logoImage} alt="zapurzaa" className="h-8" />
                  <span 
                    className="text-2xl font-semibold"
                    style={{ color: option.color }}
                  >
                    NotesMateMD
                  </span>
                </div>
              </div>
            )}
            
            <div className="text-xs font-mono bg-muted p-2 rounded">
              Color code: {option.color}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
