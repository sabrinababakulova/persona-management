"use client";

import Image from "next/image";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Checkbox } from "../_components/checkbox";
import {
  BellIcon,
  ChevronDownIcon,
  FilterIcon,
  FunnelIcon,
  GlobeIcon,
  MoreIcon,
  SearchIcon,
  SortIcon,
} from "../_components/icons";
import { Sidebar } from "../_components/sidebar";
import { StatusBadge } from "../_components/status-badge";

interface Vacancy {
  id: string;
  title: string;
  level: string;
  status: "active" | "draft" | "paused" | "closed" | "archive";
  city: string;
  responses: number;
  workType: string;
  selected?: boolean;
}

export default function VacanciesPage() {
  const { data: vacanciesData, isLoading } =
    api.vacancies.getAllVacancies.useQuery();
  const [localVacancies, setLocalVacancies] = useState<Vacancy[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Merge server data with local selection state
  const vacancies =
    vacanciesData?.map((v) => ({
      ...v,
      selected: localVacancies.find((lv) => lv.id === v.id)?.selected ?? false,
    })) ?? [];

  const toggleSelection = (id: string) => {
    setLocalVacancies((prev) => {
      const existing = prev.find((v) => v.id === id);
      if (existing) {
        return prev.map((v) =>
          v.id === id ? { ...v, selected: !v.selected } : v,
        );
      }
      return [...prev, { id, selected: true } as Vacancy];
    });
  };

  const filteredVacancies = vacancies.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-bg-light">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-header-border border-b bg-white px-4 py-4 lg:px-8">
          {/* Search */}
          <div className="relative w-full max-w-md">
            <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-border-light bg-bg-light py-3 pr-4 pl-12 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Что вы хотите найти?"
              type="text"
              value={searchQuery}
            />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Language Selector */}
            <button
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-gray-600 hover:bg-bg-light sm:flex"
              type="button"
            >
              <GlobeIcon className="h-5 w-5" />
              <span>Ру</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <button
              className="relative rounded-lg p-2 text-gray-600 hover:bg-bg-light"
              type="button"
            >
              <BellIcon className="h-6 w-6" />
            </button>

            {/* Profile */}
            <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200">
              <Image
                alt="Profile"
                className="h-full w-full object-cover"
                height={40}
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Kerim"
                width={40}
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {/* Page Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-bold text-2xl text-gray-900 lg:text-3xl">
              Вакансии
            </h1>
            <button
              className="flex items-center gap-2 self-start rounded-lg border border-border-light bg-white px-4 py-2 text-gray-700 hover:bg-bg-light sm:self-auto"
              type="button"
            >
              Последние 7 дней
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Search and Filter Bar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-xl border border-border-light bg-white py-3 pr-4 pl-12 text-gray-700 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                placeholder="Поиск вакансий"
                type="text"
              />
            </div>
            <button
              className="flex items-center justify-center gap-2 rounded-xl border border-border-light bg-white px-4 py-3 text-gray-700 hover:bg-bg-light"
              type="button"
            >
              <FilterIcon className="h-5 w-5" />
              <span>Добавить фильтры</span>
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs">
                +
              </span>
            </button>
          </div>

          {/* Vacancies Table */}
          <div className="overflow-hidden rounded-2xl border border-border-light bg-white">
            {/* Table Header */}
            <div className="hidden grid-cols-12 gap-4 border-border-light border-b bg-table-header-bg px-4 py-3 font-medium text-sm text-text-muted lg:grid">
              <div className="col-span-3 flex items-center gap-1">
                <span>Название</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span>Статус</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span>Город</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span>Отклики</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span>Тип работы</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-1" />
            </div>

            {/* Mobile Table Header */}
            <div className="grid grid-cols-12 gap-4 border-border-light border-b bg-table-header-bg px-4 py-3 font-medium text-sm text-text-muted lg:hidden">
              <div className="col-span-6 flex items-center gap-1">
                <span>Вакансия</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-3 flex items-center gap-1">
                <span>Статус</span>
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-3" />
            </div>

            {/* Table Rows */}
            {filteredVacancies.map((vacancy) => (
              <div
                className="grid grid-cols-12 gap-4 border-border-light border-b px-4 py-4 last:border-b-0 hover:bg-gray-50 lg:items-center"
                key={vacancy.id}
              >
                {/* Desktop View */}
                <div className="col-span-12 flex items-start gap-3 lg:col-span-3">
                  <Checkbox
                    checked={vacancy.selected || false}
                    onChange={() => toggleSelection(vacancy.id)}
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {vacancy.title}
                    </div>
                    <div className="text-sm text-text-muted">
                      {vacancy.level}
                    </div>
                  </div>
                </div>

                {/* Status - Desktop */}
                <div className="hidden lg:col-span-2 lg:block">
                  <StatusBadge status={vacancy.status} />
                </div>

                {/* Status - Mobile */}
                <div className="col-span-6 flex items-center justify-end lg:hidden">
                  <StatusBadge status={vacancy.status} />
                </div>

                {/* City - Desktop only */}
                <div className="hidden text-gray-700 lg:col-span-2 lg:block">
                  {vacancy.city}
                </div>

                {/* Responses - Desktop only */}
                <div className="hidden text-gray-700 lg:col-span-2 lg:block">
                  {vacancy.responses}
                </div>

                {/* Work Type - Desktop only */}
                <div className="hidden text-gray-700 lg:col-span-2 lg:block">
                  {vacancy.workType}
                </div>

                {/* Actions */}
                <div className="col-span-6 flex items-center justify-end gap-2 lg:col-span-1">
                  <button
                    className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-icon-blue text-sm hover:bg-bg-light"
                    type="button"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Воронка</span>
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    type="button"
                  >
                    <MoreIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Actions Bar */}
          <div className="mt-4 flex justify-end">
            <button
              className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-4 py-2 text-gray-700 hover:bg-bg-light"
              type="button"
            >
              <span>Действия</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
