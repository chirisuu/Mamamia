"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveContentPageAction } from "../actions/content";
import { applyFieldErrors } from "../lib/form-errors";
import { CONTENT_KIND_HINTS, CONTENT_KIND_LABELS, CONTENT_KINDS } from "../lib/labels";
import { MarkdownContent } from "../lib/markdown";
import { CONTENT_BODY_MAX, contentPageSchema, type ContentPageInput } from "../schemas";
import { NativeSelect } from "./admin-ui";
import { NumberInput } from "./form-fields";

const HELP = "**negrita**, *cursiva*, # Título, - lista, 1. lista numerada, > cita, [enlace](https://…), --- separador. Sin HTML ni imágenes.";

/** Editor de `content_pages` con markdown y vista previa segura (mismo render que el panel, sin HTML crudo). */
export function ContentEditor({ initial }: { initial: ContentPageInput }) {
  const router = useRouter();
  const form = useForm<ContentPageInput, unknown, z.output<typeof contentPageSchema>>({
    resolver: zodResolver(contentPageSchema),
    defaultValues: initial,
    mode: "onBlur",
  });
  const isEdit = Boolean(initial.id);
  const [mobileView, setMobileView] = React.useState<"editar" | "vista">("editar");
  const [kind, title, body] = useWatch({ control: form.control, name: ["kind", "title", "bodyMd"] });
  const deferredBody = React.useDeferredValue(body ?? "");

  const onSubmit = form.handleSubmit(
    async () => {
      const result = await saveContentPageAction(form.getValues());
      if (!result.ok) {
        applyFieldErrors(form.setError, result.error);
        if (result.error.fieldErrors?.bodyMd) setMobileView("editar");
        toast.error(result.error.message);
        return;
      }
      toast.success(isEdit ? "Contenido guardado." : "Contenido creado.");
      if (isEdit) {
        form.reset(form.getValues());
        router.refresh();
      } else {
        router.push(`/admin/contenidos/${result.data.id}`);
      }
    },
    (errors) => {
      if (errors.bodyMd) setMobileView("editar");
    },
  );

  const editor = (
    <FormField
      control={form.control}
      name="bodyMd"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Texto (markdown)</FormLabel>
          <FormControl>
            <Textarea {...field} rows={18} maxLength={CONTENT_BODY_MAX} className="min-h-80 font-mono text-sm" spellCheck />
          </FormControl>
          <FormDescription>
            {HELP}{" "}
            <span data-numeric="">
              {formatNumber((field.value ?? "").length)} / {formatNumber(CONTENT_BODY_MAX)}
            </span>
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  const preview = (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Vista previa</p>
      <div className="min-h-80 rounded-2xl border border-border bg-background p-5">
        {title ? <p className="mb-4 text-2xl font-semibold tracking-tight">{title}</p> : null}
        {deferredBody.trim() ? (
          <MarkdownContent source={deferredBody} headingOffset={1} />
        ) : (
          <p className="text-sm text-muted-foreground">Escribe para ver cómo se verá.</p>
        )}
      </div>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Datos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{kind === "faq" ? "Pregunta" : "Título"}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={200} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {CONTENT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {CONTENT_KIND_LABELS[k]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>{kind ? CONTENT_KIND_HINTS[kind] : null}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección (slug)</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="terminos" />
                  </FormControl>
                  <FormDescription>Minúsculas, números y guiones. Cambiarla rompe los enlaces que ya existan.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden</FormLabel>
                  <FormControl>
                    <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                  </FormControl>
                  <FormDescription>Menor primero (dentro del mismo tipo).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                  <div className="grid gap-1">
                    <FormLabel>Publicado</FormLabel>
                    <FormDescription>{field.value === "published" ? "Visible en el sitio." : "Borrador: solo lo ve el equipo."}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === "published"} onCheckedChange={(on) => field.onChange(on ? "published" : "draft")} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Móvil: un selector alterna editor y vista previa; escritorio: lado a lado. */}
        <div className="lg:hidden">
          <SegmentedControl
            aria-label="Modo del editor"
            value={mobileView}
            onValueChange={setMobileView}
            options={[
              { value: "editar", label: "Editar" },
              { value: "vista", label: "Vista previa" },
            ]}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cn("min-w-0", mobileView === "vista" && "hidden lg:block")}>{editor}</div>
          <div className={cn("min-w-0", mobileView === "editar" && "hidden lg:block")}>{preview}</div>
        </div>

        {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            {isEdit ? "Guardar contenido" : "Crear contenido"}
          </Button>
          {form.formState.isDirty && isEdit ? <p className="text-sm text-muted-foreground">Tienes cambios sin guardar.</p> : null}
        </div>
      </form>
    </Form>
  );
}
