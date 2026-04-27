import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentType } from "react";

import * as Icons from "./index";
import type { IconProps } from "./types";

type IconStoryProps = IconProps & Record<string, unknown>;

const iconEntries = Object.entries(Icons).sort(([firstName], [secondName]) =>
  firstName.localeCompare(secondName),
) as Array<[string, ComponentType<IconStoryProps>]>;

const channelChartRadius = 57;
const channelChartCircumference = 2 * Math.PI * channelChartRadius;

const iconDemoProps: Record<string, Record<string, unknown>> = {
  ChannelStatisticsChartIcon: {
    circumference: channelChartCircumference,
    radius: channelChartRadius,
    segments: [
      {
        dashOffset: 0,
        name: "hh",
        segment: channelChartCircumference * 0.34,
        strokeClassName: "stroke-chart-pink",
      },
      {
        dashOffset: channelChartCircumference * 0.34,
        name: "linkedin",
        segment: channelChartCircumference * 0.28,
        strokeClassName: "stroke-chart-purple",
      },
      {
        dashOffset: channelChartCircumference * 0.62,
        name: "telegram",
        segment: channelChartCircumference * 0.22,
        strokeClassName: "stroke-chart-orange",
      },
    ],
  },
} satisfies Record<string, Record<string, unknown>>;

const meta = {
  title: "Icons/All Icons",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<{
  color: string;
  size: number;
}>;

export const All: Story = {
  args: {
    color: "#3a465d",
    size: 32,
  },
  render: ({ color, size }) => (
    <main className="min-h-screen bg-bg-light px-8 py-10 text-text-heading">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="font-semibold text-3xl">Icons</h1>
          <p className="mt-2 text-text-secondary">
            {iconEntries.length} exported icons from{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-text-menu">
              src/app/_components/icons
            </code>
          </p>
        </header>

        <section className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {iconEntries.map(([name, Icon]) => (
            <article
              className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-border-light bg-white p-4 text-center shadow-sm"
              key={name}
            >
              <div
                className="mb-4 flex h-20 w-20 items-center justify-center rounded-md bg-bg-light text-text-menu"
                style={{ color }}
              >
                <Icon
                  aria-label={name}
                  className="shrink-0"
                  height={size}
                  role="img"
                  width={size}
                  {...iconDemoProps[name]}
                />
              </div>
              <span className="break-all font-medium text-sm">{name}</span>
            </article>
          ))}
        </section>
      </div>
    </main>
  ),
};
