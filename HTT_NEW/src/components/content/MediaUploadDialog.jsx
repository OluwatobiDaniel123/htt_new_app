import React, { useState } from 'react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload } from 'lucide-react';

export default function MediaUploadDialog({ story, open, onOpenChange, onUploaded }) {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Choose an image or video file.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Files must be 20 MB or smaller.');
      const signature = await api.post('/media/signature', { resourceType: file.type.startsWith('video/') ? 'video' : 'image', mimeType: file.type, byteSize: file.size });
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('folder', signature.folder);
      form.append('public_id', signature.publicId);
      form.append('type', signature.type);
      form.append('signature', signature.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`, { method: 'POST', body: form });
      const uploaded = await response.json();
      if (!response.ok) throw new Error(uploaded?.error?.message || 'Cloudinary upload failed.');
      const asset = await api.post('/media/assets', { publicId: uploaded.public_id, secureUrl: uploaded.secure_url, resourceType: signature.resourceType, mimeType: file.type, byteSize: uploaded.bytes, originalName: file.name });
      await api.post(`/media/stories/${story.id}/media`, { mediaAssetId: asset.id });
      toast({ title: 'Media attached', description: 'Stored privately — approval is required before publication.' });
      onUploaded?.();
      onOpenChange(false);
      setFile(null);
    } catch (uploadError) {
      setError(uploadError.message || 'The file could not be uploaded. Check the format and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!uploading ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Attach media</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {story?.title} · files are stored privately (no public URL).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-[12.5px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Images and video only. Content featuring children needs explicit safeguarding approval
            before it can be published.
          </p>
          {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#0B1F3A] hover:bg-[#132E52]"
            onClick={upload}
            disabled={!file || uploading}
          >
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
