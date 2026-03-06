import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui-kit/button";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "~/components/ui-kit/dialog";
import { Input } from "~/components/ui-kit/input";
import { Field, Label, ErrorMessage } from "~/components/ui-kit/fieldset";

export function AddVideoDialog() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const errors =
    fetcher.data && !fetcher.data.success ? fetcher.data.errors : null;

  return (
    <>
      <Button color="blue" onClick={() => setOpen(true)}>
        Add Video
      </Button>
      <Dialog open={open} onClose={() => !isSubmitting && setOpen(false)}>
        <DialogTitle>Add a YouTube video</DialogTitle>
        <DialogDescription>
          Paste a YouTube URL and we&apos;ll transcribe it for you.
        </DialogDescription>
        <fetcher.Form
          method="post"
          onSubmit={() => {
            setTimeout(() => setOpen(false), 100);
          }}
        >
          <DialogBody>
            <Field>
              <Label>YouTube URL</Label>
              <Input
                name="youtubeUrl"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                required
                autoFocus
              />
              {errors?.youtubeUrl && (
                <ErrorMessage>{errors.youtubeUrl[0]}</ErrorMessage>
              )}
            </Field>
          </DialogBody>
          <DialogActions>
            <Button
              plain
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" color="blue" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Video"}
            </Button>
          </DialogActions>
        </fetcher.Form>
      </Dialog>
    </>
  );
}
