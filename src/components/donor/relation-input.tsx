"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { RELATIONS, RELATION_TITLES, type Relation } from "@/lib/validations/donor";
import { cn } from "@/lib/utils";

/**
 * Father's, mother's or spouse's name — one of them, in one place.
 *
 * The relation picks the titles on offer (a father is Mr. or Lt., a mother
 * Mrs. or Lt., a spouse any of the three), and switching it keeps the title
 * when the new relation allows it rather than posting one it does not.
 * Posts `relation`, `relationTitle` and `relationName`, as
 * `donorRegistrationSchema` and `donorProfileSchema` read them.
 */
export function RelationInput({
  defaultRelation = "father",
  defaultTitle,
  defaultName = "",
  invalid,
  inputClassName,
  id = "relationName",
}: {
  defaultRelation?: Relation;
  defaultTitle?: string;
  defaultName?: string;
  invalid?: boolean;
  inputClassName?: string;
  id?: string;
}) {
  const [relation, setRelation] = useState<Relation>(defaultRelation);
  const titles = RELATION_TITLES[relation];
  const [title, setTitle] = useState<string>(
    defaultTitle && titles.some((t) => t.value === defaultTitle) ? defaultTitle : titles[0].value,
  );

  return (
    <div className="flex gap-2">
      <Dropdown
        name="relation"
        value={relation}
        onValueChange={(v) => {
          const next = v as Relation;
          setRelation(next);
          if (!RELATION_TITLES[next].some((t) => t.value === title)) {
            setTitle(RELATION_TITLES[next][0].value);
          }
        }}
        options={RELATIONS}
        className="w-28 shrink-0"
      />
      <Dropdown
        name="relationTitle"
        value={title}
        onValueChange={setTitle}
        options={titles}
        className="w-20 shrink-0"
      />
      <Input
        id={id}
        name="relationName"
        required
        defaultValue={defaultName}
        placeholder={relation === "spouse" ? "Spouse's name" : relation === "mother" ? "Mother's name" : "Father's name"}
        aria-invalid={invalid || undefined}
        className={cn("min-w-0 flex-1", inputClassName)}
      />
    </div>
  );
}
