"use client";

import Image from "next/image";
import { ExternalLink, MousePointer2 } from "lucide-react";
import { useState } from "react";

const rooms = [
  {
    id: "living",
    label: "Living room",
    note: "Open-plan living space with direct access to the terrace.",
    image: "/property-demo/living-room.svg",
    position: "left-[48%] top-[48%]",
  },
  {
    id: "terrace",
    label: "Terrace",
    note: "Sea-facing outdoor area connected to the main living zone.",
    image: "/property-demo/terrace.svg",
    position: "left-[49%] top-[16%]",
  },
  {
    id: "bedroom",
    label: "Principal bedroom",
    note: "Private bedroom zone separated from the social spaces.",
    image: "/property-demo/bedroom.svg",
    position: "left-[24%] top-[58%]",
  },
];

export default function InteractiveFloorPlanDemo() {
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0].id);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];

  return (
    <section
      id="interactive-floor-plan"
      className="scroll-mt-36 bg-[#0f2440] text-white"
    >
      <div className="mx-auto grid max-w-[1480px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:px-10 lg:py-28">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] bg-white p-3 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:p-6">
          <Image
            src="/property-demo/floor-plan.svg"
            alt="Interactive demonstration floor plan"
            fill
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-contain p-6 sm:p-10"
          />

          {rooms.map((room) => {
            const isSelected = room.id === selectedRoom.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                aria-label={`Show ${room.label}`}
                aria-pressed={isSelected}
                className={`absolute ${room.position} grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold shadow-xl transition hover:scale-110 sm:h-11 sm:w-11 ${
                  isSelected
                    ? "bg-[#c7a94e] text-[#0f2440]"
                    : "bg-[#0f2440] text-white"
                }`}
              >
                {room.label.charAt(0)}
              </button>
            );
          })}
        </div>

        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#d4bc6a]">
            <MousePointer2 className="h-4 w-4" aria-hidden />
            Interactive floor plan
          </p>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl lg:text-5xl">
            Select a room and open its photography.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/65">
            A live property can link to a CubiCasa, Kuula or another interactive floor-plan experience. It may also be embedded directly into this page when the provider allows it.
          </p>

          <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/6">
            <div className="relative aspect-[16/9] overflow-hidden">
              <Image
                src={selectedRoom.image}
                alt={selectedRoom.label}
                fill
                sizes="(min-width: 1024px) 36vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-lg font-semibold">{selectedRoom.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/60">{selectedRoom.note}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  room.id === selectedRoom.id
                    ? "bg-white text-[#0f2440]"
                    : "border border-white/15 text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {room.label}
              </button>
            ))}
          </div>

          <a
            href="#contact"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#c7a94e] px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-[#d4bc6a]"
          >
            Open live provider link
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
