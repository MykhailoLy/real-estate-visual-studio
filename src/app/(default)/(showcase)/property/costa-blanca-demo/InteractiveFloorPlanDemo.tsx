"use client";

import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MousePointer2,
} from "lucide-react";
import { useRef, useState } from "react";

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
  const stageRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    rooms.findIndex((room) => room.id === selectedRoomId),
    0,
  );
  const selectedRoom = rooms[selectedIndex];

  const selectRelativeRoom = (offset: number) => {
    const nextIndex = (selectedIndex + offset + rooms.length) % rooms.length;
    setSelectedRoomId(rooms[nextIndex].id);
  };

  const openFullscreen = async () => {
    const element = stageRef.current;
    if (!element || !document.fullscreenEnabled) return;

    try {
      await element.requestFullscreen();
    } catch {
      // The split-screen experience still works when fullscreen is unavailable.
    }
  };

  return (
    <section
      id="interactive-floor-plan"
      className="scroll-mt-36 bg-[#0f2440] py-6 text-white sm:py-10"
    >
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <div
          ref={stageRef}
          className="flex min-h-[82svh] flex-col overflow-hidden rounded-[1.5rem] bg-[#151515] shadow-[0_35px_120px_rgba(0,0,0,0.35)] sm:rounded-[2rem]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/45 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4bc6a] sm:text-xs">
                <MousePointer2 className="h-4 w-4" aria-hidden />
                Interactive floor plan
              </p>
              <p className="mt-1 text-sm font-semibold sm:text-lg">
                Sea View Residence · {selectedRoom.label}
              </p>
            </div>

            <button
              type="button"
              onClick={openFullscreen}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/15 sm:h-12 sm:w-12"
              aria-label="Open interactive floor plan fullscreen"
            >
              <Maximize2 className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="grid flex-1 lg:grid-cols-[0.46fr_0.54fr]">
            <div className="relative min-h-[430px] bg-[#ece9e2] p-3 sm:min-h-[560px] sm:p-6 lg:min-h-0">
              <Image
                src="/property-demo/floor-plan.svg"
                alt="Interactive demonstration floor plan"
                fill
                sizes="(min-width: 1024px) 46vw, 100vw"
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

              <div className="absolute inset-x-4 bottom-4 flex flex-wrap justify-center gap-2 sm:inset-x-6 sm:bottom-6">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur transition sm:px-4 sm:text-sm ${
                      room.id === selectedRoom.id
                        ? "bg-[#0f2440] text-white"
                        : "border border-black/10 bg-white/90 text-[#0f2440] hover:bg-white"
                    }`}
                  >
                    {room.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-[520px] flex-col bg-black lg:min-h-0">
              <div className="relative flex-1 overflow-hidden">
                <Image
                  src={selectedRoom.image}
                  alt={selectedRoom.label}
                  fill
                  sizes="(min-width: 1024px) 54vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/65" />

                <button
                  type="button"
                  onClick={() => selectRelativeRoom(-1)}
                  className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 sm:left-6 sm:h-14 sm:w-14"
                  aria-label="Previous room"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => selectRelativeRoom(1)}
                  className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 sm:right-6 sm:h-14 sm:w-14"
                  aria-label="Next room"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden />
                </button>

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-8">
                  <p className="text-2xl font-semibold sm:text-3xl">
                    {selectedRoom.label}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
                    {selectedRoom.note}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bc6a]">
                    {selectedIndex + 1} of {rooms.length} room groups
                  </p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-[#111] p-3 sm:p-4">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`relative h-20 min-w-28 overflow-hidden rounded-xl border-2 transition sm:h-24 sm:min-w-36 ${
                      room.id === selectedRoom.id
                        ? "border-[#c7a94e]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Open ${room.label}`}
                  >
                    <Image
                      src={room.image}
                      alt=""
                      fill
                      sizes="144px"
                      className="object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-left text-[10px] font-semibold text-white sm:text-xs">
                      {room.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
