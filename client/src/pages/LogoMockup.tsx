import logoImage from "@assets/ZSPL-Logo-Only Name_1763102256187.png";

export default function LogoMockup() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-12">
        <h1 className="text-3xl font-bold text-center mb-12">Logo Mockup Preview</h1>
        
        {/* White Background Preview */}
        <div className="border rounded-lg p-12 bg-white">
          <h2 className="text-sm font-medium text-gray-600 mb-6">On White Background (Login Screen)</h2>
          <div className="flex items-center justify-center gap-3">
            <img src={logoImage} alt="zapurzaa" className="h-12" />
            <span className="text-4xl font-semibold" style={{ color: '#17a2b8' }}>
              NotesMate MD
            </span>
          </div>
        </div>

        {/* Light Gray Background Preview */}
        <div className="border rounded-lg p-12 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-600 mb-6">On Light Background</h2>
          <div className="flex items-center justify-center gap-3">
            <img src={logoImage} alt="zapurzaa" className="h-12" />
            <span className="text-4xl font-semibold" style={{ color: '#17a2b8' }}>
              NotesMate MD
            </span>
          </div>
        </div>

        {/* Larger Size Preview */}
        <div className="border rounded-lg p-12 bg-white">
          <h2 className="text-sm font-medium text-gray-600 mb-6">Larger Size (Hero)</h2>
          <div className="flex items-center justify-center gap-4">
            <img src={logoImage} alt="zapurzaa" className="h-16" />
            <span className="text-5xl font-semibold" style={{ color: '#17a2b8' }}>
              NotesMate MD
            </span>
          </div>
        </div>

        {/* Smaller Size Preview */}
        <div className="border rounded-lg p-12 bg-white">
          <h2 className="text-sm font-medium text-gray-600 mb-6">Smaller Size (Header)</h2>
          <div className="flex items-center justify-center gap-2">
            <img src={logoImage} alt="zapurzaa" className="h-8" />
            <span className="text-2xl font-semibold" style={{ color: '#17a2b8' }}>
              NotesMate MD
            </span>
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Color: Medical Teal <span className="font-mono">#17a2b8</span>
          </p>
          <p className="text-xs text-muted-foreground">
            This preview shows how the logo will appear in different sizes and backgrounds
          </p>
        </div>
      </div>
    </div>
  );
}
