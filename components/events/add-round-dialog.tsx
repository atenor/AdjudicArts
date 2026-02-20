"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RoundType } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roundSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.nativeEnum(RoundType),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

type RoundFormValues = z.infer<typeof roundSchema>;

export default function AddRoundDialog({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoundFormValues>({
    resolver: zodResolver(roundSchema),
    defaultValues: { type: RoundType.CHAPTER },
  });

  async function onSubmit(data: RoundFormValues) {
    setServerError(null);

    const payload = {
      name: data.name,
      type: data.type,
      startAt: data.startAt ? new Date(data.startAt).toISOString() : null,
      endAt: data.endAt ? new Date(data.endAt).toISOString() : null,
    };

    const res = await fetch(`/api/events/${eventId}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setServerError("Failed to add round. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add Round</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Round</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="round-name">Round Name *</Label>
            <Input id="round-name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Round Type *</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RoundType.CHAPTER}>Chapter</SelectItem>
                    <SelectItem value={RoundType.NATIONAL}>National</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="round-start">Starts</Label>
              <Input id="round-start" type="date" {...register("startAt")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="round-end">Ends</Label>
              <Input id="round-end" type="date" {...register("endAt")} />
            </div>
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Round"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
