import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Upload, 
  FileText, 
  Image, 
  File, 
  Trash2, 
  Download, 
  Loader2,
  Plus,
  X,
  Paperclip
} from 'lucide-react';
import { format } from 'date-fns';
import type { VisitDocument } from '@shared/schema';

interface VisitDocumentsProps {
  visitId: string;
  readOnly?: boolean;
}

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/gif': Image,
  'image/webp': Image,
  'default': File
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function VisitDocuments({ visitId, readOnly = false }: VisitDocumentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: documents = [], isLoading, error } = useQuery<VisitDocument[]>({
    queryKey: ['/api/visits', visitId, 'documents'],
    enabled: !!visitId,
    queryFn: async () => {
      const token = sessionStorage.getItem('notesmate_access_token');
      const response = await fetch(`/api/visits/${visitId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load documents');
      }
      return response.json();
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, desc }: { file: File; desc: string }) => {
      // Log file info for debugging
      console.log(`Upload starting: name=${file.name}, size=${file.size}, type=${file.type}`);
      
      // Read file FIRST to get actual content - file.size can be unreliable in some browsers
      const fileBuffer = await file.arrayBuffer();
      console.log(`File buffer loaded: ${fileBuffer.byteLength} bytes (reported size: ${file.size})`);
      
      // Validate based on actual buffer content, not file.size metadata
      if (fileBuffer.byteLength === 0) {
        throw new Error('File appears to be empty. Please try selecting the file again.');
      }
      
      // Only reject very small non-text files based on actual buffer content
      const isTextFile = file.type.startsWith('text/');
      if (fileBuffer.byteLength < 10 && !isTextFile) {
        throw new Error('File size is suspiciously small. Please verify the file is not corrupted.');
      }
      
      // Create a Blob from the buffer and attach to FormData with filename
      const verifiedBlob = new Blob([fileBuffer], { type: file.type });
      console.log(`Verified blob: size=${verifiedBlob.size}, type=${verifiedBlob.type}`);
      
      const formData = new FormData();
      formData.append('document', verifiedBlob, file.name);
      if (desc) {
        formData.append('description', desc);
      }
      
      const token = sessionStorage.getItem('notesmate_access_token');
      const response = await fetch(`/api/visits/${visitId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }
      
      const result = await response.json();
      
      // Verify the uploaded size matches what we sent
      if (result.file_size_bytes && result.file_size_bytes !== verifiedBlob.size) {
        console.error(`Size mismatch! Sent: ${verifiedBlob.size}, Stored: ${result.file_size_bytes}`);
        throw new Error('Upload verification failed - file size mismatch. Please try again.');
      }
      
      console.log(`Upload successful: ${result.document_id}, size=${result.file_size_bytes}`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/visits', visitId, 'documents'] });
      // Also invalidate patient visits to update document counts in history
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0]?.toString().includes('/api/patients') && key[0]?.toString().includes('/visits');
      }});
      toast({
        title: 'Document uploaded',
        description: 'The document has been uploaded successfully.'
      });
      resetUploadForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const token = sessionStorage.getItem('notesmate_access_token');
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/visits', visitId, 'documents'] });
      // Also invalidate patient visits to update document counts in history
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0]?.toString().includes('/api/patients') && key[0]?.toString().includes('/visits');
      }});
      toast({
        title: 'Document deleted',
        description: 'The document has been removed.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadForm(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({ file: selectedFile, desc: description });
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setDescription('');
    setShowUploadForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      await deleteMutation.mutateAsync(documentId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (document: VisitDocument) => {
    setDownloadingId(document.document_id);
    try {
      const token = sessionStorage.getItem('notesmate_access_token');
      const response = await fetch(`/api/documents/${document.document_id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.original_filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download document',
        variant: 'destructive'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    const IconComponent = FILE_TYPE_ICONS[mimeType] || FILE_TYPE_ICONS['default'];
    return <IconComponent className="h-5 w-5" />;
  };

  if (error) {
    return (
      <Card data-testid="card-visit-documents">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load documents</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-visit-documents">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Documents
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-2" data-testid="badge-document-count">
                {documents.length}
              </Badge>
            )}
          </span>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-add-document"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file-upload"
          />
        )}

        {!readOnly && showUploadForm && selectedFile && (
          <div className="border rounded-md p-4 space-y-3 bg-muted/30" data-testid="form-upload">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(selectedFile.type)}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetUploadForm}
                data-testid="button-cancel-upload"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a description for this document..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none text-sm"
                rows={2}
                data-testid="input-document-description"
              />
            </div>
            
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full"
              data-testid="button-upload-document"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground" data-testid="text-no-documents">
            No documents attached to this visit
          </div>
        ) : (
          <div className="space-y-2">
            {documents.filter(doc => !doc.is_deleted).map((doc) => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                data-testid={`document-item-${doc.document_id}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.mime_type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={doc.original_filename}>
                      {doc.original_filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size_bytes)}</span>
                      {doc.created_at && (
                        <>
                          <span>•</span>
                          <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                        </>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={doc.description}>
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.document_id}
                    data-testid={`button-download-${doc.document_id}`}
                  >
                    {downloadingId === doc.document_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.document_id)}
                      disabled={deletingId === doc.document_id}
                      data-testid={`button-delete-${doc.document_id}`}
                    >
                      {deletingId === doc.document_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
