import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const SLOTS_PER_HOUR = 2;
const SLOT_MINUTES = 60 / SLOTS_PER_HOUR;
const TOTAL_SLOTS = 24 * SLOTS_PER_HOUR;
const HOUR_HEIGHT = 56;
const SLOT_HEIGHT = HOUR_HEIGHT / SLOTS_PER_HOUR;

const WEEK_DAYS = [
  { value: "0", label: "Domingo", short: "Dom" },
  { value: "1", label: "Segunda", short: "Seg" },
  { value: "2", label: "Terca", short: "Ter" },
  { value: "3", label: "Quarta", short: "Qua" },
  { value: "4", label: "Quinta", short: "Qui" },
  { value: "5", label: "Sexta", short: "Sex" },
  { value: "6", label: "Sabado", short: "Sab" },
];

const LI_CREATE = {
  account_id: "",
  topic: "",
  day_of_week: "",
  time_local: "",
  timezone: DEFAULT_TIMEZONE,
  is_active: true,
};
const LC_CREATE = {
  repository_id: "",
  day_of_week: "",
  time_local: "",
  timezone: DEFAULT_TIMEZONE,
  selection_strategy: "random",
  difficulty_policy: "random",
  max_attempts: 2,
  is_active: true,
};

function nextRoundedSlot() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.min(23 * 60 + 30, Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES);
  return {
    dayOfWeek: now.getDay(),
    timeLocal: minutesToTime(rounded),
  };
}

export default function SchedulesPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingLi, setSavingLi] = useState(false);
  const [savingLc, setSavingLc] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState("linkedin");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [linkedinSchedules, setLinkedinSchedules] = useState([]);
  const [leetcodeSchedules, setLeetcodeSchedules] = useState([]);
  const [liForm, setLiForm] = useState(LI_CREATE);
  const [lcForm, setLcForm] = useState(LC_CREATE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingRow, setEditingRow] = useState(null);
  const [dragState, setDragState] = useState(null);

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [liAccounts, ghRepos, liSchedules, lcSchedules] = await Promise.all([
        api.linkedinAccounts(),
        api.githubRepositories(),
        api.linkedinSchedules(),
        api.leetcodeSchedules(),
      ]);
      setAccounts(liAccounts ?? []);
      setRepositories(ghRepos ?? []);
      setLinkedinSchedules(liSchedules ?? []);
      setLeetcodeSchedules(lcSchedules ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar agendamentos."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const scheduleRows = useMemo(() => {
    const accountById = new Map(accounts.map((item) => [item.id, item.name]));
    const repoById = new Map(repositories.map((item) => [item.id, extractRepoName(item.repo_ssh_url)]));

    const liRows = linkedinSchedules
      .map((item) => {
        const slot = resolveScheduleSlot(item);
        if (!slot) return null;
        return {
          id: item.id,
          uid: `li-${item.id}`,
          kind: "linkedin_post",
          destination: accountById.get(item.account_id) ?? `Conta #${item.account_id}`,
          frequency: item.cron_expr,
          timezone: item.timezone || DEFAULT_TIMEZONE,
          retries: "-",
          isActive: item.is_active,
          updatedAt: item.updated_at,
          dayOfWeek: slot.dayOfWeek,
          timeLocal: slot.timeLocal,
          minutes: slot.minutes,
          raw: item,
        };
      })
      .filter(Boolean);

    const lcRows = leetcodeSchedules
      .map((item) => {
        const slot = resolveScheduleSlot(item);
        if (!slot) return null;
        return {
          id: item.id,
          uid: `lc-${item.id}`,
          kind: "leetcode_commit",
          destination: repoById.get(item.repository_id) ?? `Repo #${item.repository_id}`,
          frequency: item.cron_expr,
          timezone: item.timezone || DEFAULT_TIMEZONE,
          retries: String(item.max_attempts || "-"),
          isActive: item.is_active,
          updatedAt: item.updated_at,
          dayOfWeek: slot.dayOfWeek,
          timeLocal: slot.timeLocal,
          minutes: slot.minutes,
          raw: item,
        };
      })
      .filter(Boolean);

    return [...liRows, ...lcRows].sort((a, b) => a.minutes - b.minutes || a.id - b.id);
  }, [accounts, repositories, linkedinSchedules, leetcodeSchedules]);

  const rowsByDay = useMemo(() => {
    const grouped = new Map(Array.from({ length: 7 }, (_, day) => [day, []]));
    scheduleRows.forEach((row) => grouped.get(row.dayOfWeek)?.push(row));
    return grouped;
  }, [scheduleRows]);

  const rows = useMemo(
    () => [...scheduleRows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [scheduleRows],
  );

  const openCreateModal = ({ dayOfWeek, timeLocal, flow } = {}) => {
    const fallback = nextRoundedSlot();
    const resolvedDay = Number.isInteger(dayOfWeek) ? dayOfWeek : fallback.dayOfWeek;
    const resolvedTime = timeLocal || fallback.timeLocal;

    const baseSlot = {
      day_of_week: String(resolvedDay),
      time_local: resolvedTime,
      timezone: DEFAULT_TIMEZONE,
      is_active: true,
    };

    setLiForm((prev) => ({ ...LI_CREATE, ...baseSlot, account_id: prev.account_id || "" }));
    setLcForm((prev) => ({ ...LC_CREATE, ...baseSlot, repository_id: prev.repository_id || "" }));
    setTab(flow || tab);
    setModalMode("create");
    setEditingRow(null);
    setIsModalOpen(true);
  };

  const openEditModal = (row) => {
    setTab(row.kind === "linkedin_post" ? "linkedin" : "leetcode");
    setModalMode("edit");
    setEditingRow(row);
    if (row.kind === "linkedin_post") {
      setLiForm({
        ...LI_CREATE,
        account_id: String(row.raw.account_id),
        topic: row.raw.topic || "",
        day_of_week: String(row.dayOfWeek),
        time_local: row.timeLocal,
        timezone: row.raw.timezone || DEFAULT_TIMEZONE,
        is_active: row.isActive,
      });
    } else {
      setLcForm({
        ...LC_CREATE,
        repository_id: String(row.raw.repository_id),
        day_of_week: String(row.dayOfWeek),
        time_local: row.timeLocal,
        timezone: row.raw.timezone || DEFAULT_TIMEZONE,
        selection_strategy: row.raw.selection_strategy || "random",
        difficulty_policy: row.raw.difficulty_policy || "random",
        max_attempts: Number(row.raw.max_attempts || 2),
        is_active: row.isActive,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalMode("create");
    setEditingRow(null);
  };

  const createLinkedin = async (event) => {
    event.preventDefault();
    if (savingLi) return;
    setSavingLi(true);
    setError("");
    setSuccess("");
    try {
      const normalizedTimeLocal = sanitizeTimeInput(liForm.time_local);
      if (!isValidLocalTime(normalizedTimeLocal)) {
        throw new Error("Hora local invalida. Use o formato HH:MM.");
      }
      const payload = {
        account_id: Number(liForm.account_id),
        topic: liForm.topic.trim(),
        day_of_week: Number(liForm.day_of_week),
        time_local: normalizedTimeLocal,
        timezone: DEFAULT_TIMEZONE,
        is_active: liForm.is_active,
      };

      if (modalMode === "edit" && editingRow?.kind === "linkedin_post") {
        await api.updateLinkedinSchedule(editingRow.id, payload);
        setSuccess("Agendamento LinkedIn atualizado.");
      } else {
        await api.createLinkedinSchedule(payload);
        setSuccess("Agendamento LinkedIn criado.");
      }

      closeModal();
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar agendamento LinkedIn."));
    } finally {
      setSavingLi(false);
    }
  };

  const createLeetcode = async (event) => {
    event.preventDefault();
    if (savingLc) return;
    setSavingLc(true);
    setError("");
    setSuccess("");
    try {
      const normalizedTimeLocal = sanitizeTimeInput(lcForm.time_local);
      if (!isValidLocalTime(normalizedTimeLocal)) {
        throw new Error("Hora local invalida. Use o formato HH:MM.");
      }
      const payload = {
        repository_id: Number(lcForm.repository_id),
        day_of_week: Number(lcForm.day_of_week),
        time_local: normalizedTimeLocal,
        timezone: DEFAULT_TIMEZONE,
        selection_strategy: lcForm.selection_strategy,
        difficulty_policy: lcForm.difficulty_policy,
        max_attempts: Number(lcForm.max_attempts) || 2,
        is_active: lcForm.is_active,
      };

      if (modalMode === "edit" && editingRow?.kind === "leetcode_commit") {
        await api.updateLeetcodeSchedule(editingRow.id, payload);
        setSuccess("Agendamento LeetCode atualizado.");
      } else {
        await api.createLeetcodeSchedule(payload);
        setSuccess("Agendamento LeetCode criado.");
      }

      closeModal();
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar agendamento LeetCode."));
    } finally {
      setSavingLc(false);
    }
  };

  const toggleActive = async (row, checked) => {
    if (busyId) return;
    setBusyId(row.uid);
    setError("");
    try {
      if (row.kind === "linkedin_post") await api.updateLinkedinSchedule(row.id, { is_active: checked });
      else await api.updateLeetcodeSchedule(row.id, { is_active: checked });
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar status do agendamento."));
    } finally {
      setBusyId("");
    }
  };

  const deleteSchedule = async (row) => {
    if (busyId) return;
    const label = row.kind === "linkedin_post" ? "LinkedIn" : "LeetCode";
    const shouldDelete = window.confirm(`Excluir agendamento ${label} #${row.id}? Essa acao nao pode ser desfeita.`);
    if (!shouldDelete) return;

    setBusyId(row.uid);
    setError("");
    setSuccess("");
    try {
      if (row.kind === "linkedin_post") await api.deleteLinkedinSchedule(row.id);
      else await api.deleteLeetcodeSchedule(row.id);
      setSuccess("Agendamento excluido com sucesso.");
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao excluir agendamento."));
    } finally {
      setBusyId("");
    }
  };

  const startDrag = (day, slot, flow = tab) => {
    setDragState({
      day,
      flow,
      startSlot: slot,
      endSlot: slot,
      dragging: true,
    });
  };

  const moveDrag = (day, slot) => {
    if (!dragState?.dragging || dragState.day !== day) return;
    setDragState((prev) => ({ ...prev, endSlot: slot }));
  };

  const endDrag = () => {
    if (!dragState?.dragging) return;
    const slot = Math.min(dragState.startSlot, dragState.endSlot);
    const minutes = slot * SLOT_MINUTES;
    openCreateModal({
      dayOfWeek: dragState.day,
      timeLocal: minutesToTime(minutes),
      flow: dragState.flow,
    });
    setDragState(null);
  };

  const isSlotSelected = (day, slot) => {
    if (!dragState || dragState.day !== day) return false;
    const start = Math.min(dragState.startSlot, dragState.endSlot);
    const end = Math.max(dragState.startSlot, dragState.endSlot);
    return slot >= start && slot <= end;
  };

  if (loading) {
    return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;
  }

  return (
    <div className="space-y-5" onMouseUp={endDrag}>
      {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}
      {success ? <Message tone="success" text={success} isDarkMode={isDarkMode} /> : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Planejamento</p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Agenda Semanal Recorrente</h2>
            <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>Clique ou arraste no calendario para criar um agendamento.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => openCreateModal({ flow: tab })} className={`rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>Novo agendamento</button>
            <button type="button" onClick={() => loadData({ silent: true })} className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Calendario de automacoes</h3>
          <div className={`inline-flex rounded-xl border p-1 text-xs ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
            <Chip active={tab === "linkedin"} onClick={() => setTab("linkedin")} isDarkMode={isDarkMode}>Selecionar: LinkedIn</Chip>
            <Chip active={tab === "leetcode"} onClick={() => setTab("leetcode")} isDarkMode={isDarkMode}>Selecionar: LeetCode</Chip>
          </div>
        </div>

        <div className={`overflow-x-auto rounded-xl border ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
          <div className="min-w-[980px]">
            <div className={`grid grid-cols-[80px_repeat(7,minmax(120px,1fr))] border-b ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
              <div className="px-3 py-2" />
              {WEEK_DAYS.map((day) => (
                <div key={day.value} className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {day.short}
                </div>
              ))}
            </div>

            <div className="max-h-[720px] overflow-y-auto">
              <div className="grid grid-cols-[80px_repeat(7,minmax(120px,1fr))]">
                <div className={`relative ${isDarkMode ? "bg-slate-900" : "bg-white"}`} style={{ height: HOUR_HEIGHT * 24 }}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className={`absolute left-0 right-0 text-[11px] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
                      style={{ top: hour * HOUR_HEIGHT - 8 }}
                    >
                      <span className="pl-2">{String(hour).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>

                {WEEK_DAYS.map((day) => {
                  const dayNum = Number(day.value);
                  const events = rowsByDay.get(dayNum) || [];
                  return (
                    <div
                      key={day.value}
                      className={`relative border-l ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}
                      style={{ height: HOUR_HEIGHT * 24 }}
                      onMouseUp={endDrag}
                    >
                      {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                        <button
                          key={`${day.value}-${slot}`}
                          type="button"
                          onMouseDown={() => startDrag(dayNum, slot)}
                          onMouseEnter={() => moveDrag(dayNum, slot)}
                          onMouseUp={endDrag}
                          className={`absolute left-0 right-0 border-b text-left transition ${isDarkMode ? "border-slate-800/80 hover:bg-sky-900/20" : "border-slate-100 hover:bg-sky-50"} ${isSlotSelected(dayNum, slot) ? (isDarkMode ? "bg-sky-800/30" : "bg-sky-100") : ""}`}
                          style={{
                            top: slot * SLOT_HEIGHT,
                            height: SLOT_HEIGHT,
                          }}
                          aria-label={`Selecionar ${day.label} ${minutesToTime(slot * SLOT_MINUTES)}`}
                        />
                      ))}

                      {events.map((event) => (
                        <article
                          key={event.uid}
                          className={`absolute left-1 right-1 z-10 rounded-lg border p-2 shadow-sm ${event.kind === "linkedin_post" ? (isDarkMode ? "border-sky-500/40 bg-sky-900/35" : "border-sky-300 bg-sky-50") : (isDarkMode ? "border-emerald-500/40 bg-emerald-900/35" : "border-emerald-300 bg-emerald-50")}`}
                          style={{
                            top: Math.max(0, event.minutes / 60 * HOUR_HEIGHT),
                            minHeight: 58,
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{event.kind === "linkedin_post" ? "LinkedIn" : "LeetCode"}</p>
                          <p className={`truncate text-xs font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{event.timeLocal} • {event.destination}</p>
                          <div className="mt-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(event)}
                              className={`rounded px-2 py-0.5 text-[10px] font-medium ${isDarkMode ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={busyId === event.uid}
                              onClick={() => toggleActive(event, !event.isActive)}
                              className={`rounded px-2 py-0.5 text-[10px] font-medium ${event.isActive ? (isDarkMode ? "bg-emerald-700/70 text-emerald-100" : "bg-emerald-200 text-emerald-800") : (isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700")}`}
                            >
                              {event.isActive ? "Ativo" : "Inativo"}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === event.uid}
                              onClick={() => deleteSchedule(event)}
                              className={`rounded px-2 py-0.5 text-[10px] font-medium ${isDarkMode ? "bg-red-900/50 text-red-200 hover:bg-red-900/70" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                            >
                              Excluir
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Resumo dos schedules</h3>
        {rows.length === 0 ? (
          <Empty isDarkMode={isDarkMode} text="Nenhum schedule encontrado." />
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <article key={row.uid} className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{row.kind} #{row.id}</p>
                    <p className={`text-sm ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{row.destination} • {WEEK_DAYS[row.dayOfWeek]?.short} {row.timeLocal}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge active={row.isActive} isDarkMode={isDarkMode} />
                    <ToggleSwitch checked={row.isActive} disabled={busyId === row.uid} onChange={(checked) => toggleActive(row, checked)} isDarkMode={isDarkMode} />
                    <button type="button" onClick={() => openEditModal(row)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-700" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>Editar</button>
                    <button type="button" disabled={busyId === row.uid} onClick={() => deleteSchedule(row)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${isDarkMode ? "border-red-800/80 bg-red-950/40 text-red-200 hover:bg-red-900/50" : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"}`}>Excluir</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isModalOpen ? (
        <CreateScheduleModal
          isDarkMode={isDarkMode}
          tab={tab}
          setTab={setTab}
          accounts={accounts}
          repositories={repositories}
          liForm={liForm}
          setLiForm={setLiForm}
          lcForm={lcForm}
          setLcForm={setLcForm}
          createLinkedin={createLinkedin}
          createLeetcode={createLeetcode}
          savingLi={savingLi}
          savingLc={savingLc}
          mode={modalMode}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

function CreateScheduleModal({
  isDarkMode,
  tab,
  setTab,
  accounts,
  repositories,
  liForm,
  setLiForm,
  lcForm,
  setLcForm,
  createLinkedin,
  createLeetcode,
  savingLi,
  savingLc,
  mode,
  onClose,
}) {
  const slotLabel = tab === "linkedin"
    ? `${WEEK_DAYS[Number(liForm.day_of_week)]?.label || "-"}, ${liForm.time_local || "-"}`
    : `${WEEK_DAYS[Number(lcForm.day_of_week)]?.label || "-"}, ${lcForm.time_local || "-"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/55" aria-label="Fechar modal" />
      <div className={`relative z-10 w-full max-w-2xl rounded-2xl border p-4 shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h3 className={`mb-1 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{mode === "edit" ? "Editar agendamento" : "Novo agendamento"}</h3>
        <p className={`mb-3 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>Horario selecionado: {slotLabel} • Timezone fixa: {DEFAULT_TIMEZONE}</p>

        {mode !== "edit" ? (
          <div className={`mb-3 inline-flex rounded-xl border p-1 ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
            <Chip active={tab === "linkedin"} onClick={() => setTab("linkedin")} isDarkMode={isDarkMode}>LinkedIn</Chip>
            <Chip active={tab === "leetcode"} onClick={() => setTab("leetcode")} isDarkMode={isDarkMode}>LeetCode</Chip>
          </div>
        ) : null}

        {tab === "linkedin" ? (
          <form className="space-y-3" onSubmit={createLinkedin}>
            <SelectField label="Conta" value={liForm.account_id} onChange={(value) => setLiForm((prev) => ({ ...prev, account_id: value }))} isDarkMode={isDarkMode} options={accounts.map((item) => ({ value: String(item.id), label: item.name }))} />
            <InputField label="Topico" value={liForm.topic} onChange={(value) => setLiForm((prev) => ({ ...prev, topic: value }))} isDarkMode={isDarkMode} />
            <div className="grid gap-3 grid-cols-2">
              <SelectField label="Dia" value={liForm.day_of_week} onChange={(value) => setLiForm((prev) => ({ ...prev, day_of_week: value }))} isDarkMode={isDarkMode} options={WEEK_DAYS} />
              <InputField type="time" step={60} label="Hora" value={liForm.time_local} onChange={(value) => setLiForm((prev) => ({ ...prev, time_local: value }))} isDarkMode={isDarkMode} />
            </div>
            <CheckField label="Ativo" checked={liForm.is_active} onChange={(checked) => setLiForm((prev) => ({ ...prev, is_active: checked }))} isDarkMode={isDarkMode} />
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={savingLi} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>{savingLi ? "Salvando..." : mode === "edit" ? "Salvar LinkedIn" : "Criar LinkedIn"}</button>
              <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={createLeetcode}>
            <SelectField
              label="Repositorio"
              value={lcForm.repository_id}
              onChange={(value) => setLcForm((prev) => ({ ...prev, repository_id: value }))}
              isDarkMode={isDarkMode}
              options={repositories.map((item) => ({ value: String(item.id), label: extractRepoName(item.repo_ssh_url) }))}
            />
            <div className="grid gap-3 grid-cols-2">
              <SelectField label="Dia" value={lcForm.day_of_week} onChange={(value) => setLcForm((prev) => ({ ...prev, day_of_week: value }))} isDarkMode={isDarkMode} options={WEEK_DAYS} />
              <InputField type="time" step={60} label="Hora" value={lcForm.time_local} onChange={(value) => setLcForm((prev) => ({ ...prev, time_local: value }))} isDarkMode={isDarkMode} />
            </div>
            <div className="grid gap-3 grid-cols-2">
              <SelectField
                label="Selection strategy"
                value={lcForm.selection_strategy}
                onChange={(value) => setLcForm((prev) => ({ ...prev, selection_strategy: value }))}
                isDarkMode={isDarkMode}
                options={[
                  { value: "random", label: "Aleatorio" },
                  { value: "easy_first", label: "Faceis primeiro" },
                  { value: "sequential", label: "Sequencial" },
                ]}
              />
              <SelectField
                label="Difficulty policy"
                value={lcForm.difficulty_policy}
                onChange={(value) => setLcForm((prev) => ({ ...prev, difficulty_policy: value }))}
                isDarkMode={isDarkMode}
                options={[
                  { value: "random", label: "Dificuldade Aleatoria" },
                  { value: "easy", label: "Faceis" },
                  { value: "medium", label: "Medio" },
                  { value: "hard", label: "Dificil" },
                ]}
              />
            </div>
            <InputField type="number" label="Max attempts" value={String(lcForm.max_attempts)} onChange={(value) => setLcForm((prev) => ({ ...prev, max_attempts: Number(value) || 1 }))} isDarkMode={isDarkMode} />
            <CheckField label="Ativo" checked={lcForm.is_active} onChange={(checked) => setLcForm((prev) => ({ ...prev, is_active: checked }))} isDarkMode={isDarkMode} />
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={savingLc} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>{savingLc ? "Salvando..." : mode === "edit" ? "Salvar LeetCode" : "Criar LeetCode"}</button>
              <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Message({ tone, text, isDarkMode }) {
  const styles = tone === "error"
    ? isDarkMode
      ? "border-red-900/60 bg-red-950/40 text-red-200"
      : "border-red-200 bg-red-50 text-red-700"
    : isDarkMode
      ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{text}</div>;
}

function Empty({ text, isDarkMode }) {
  return <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>{text}</div>;
}

function Chip({ active, onClick, isDarkMode, children }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? (isDarkMode ? "bg-slate-600 text-slate-100" : "bg-white text-slate-900 shadow-sm") : (isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100")}`}>{children}</button>;
}

function InputField({ label, value, onChange, isDarkMode, type = "text", step }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><input type={type} value={value} step={step} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`} /></label>;
}

function SelectField({ label, value, onChange, options, isDarkMode }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}><option value="">Selecionar...</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function CheckField({ label, checked, onChange, isDarkMode }) {
  return <label className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function StatusBadge({ active, isDarkMode }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${active ? (isDarkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}`}>{active ? "Ativo" : "Inativo"}</span>;
}

function ToggleSwitch({ checked, onChange, disabled, isDarkMode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
        checked
          ? isDarkMode
            ? "border-emerald-500/70 bg-emerald-500/30"
            : "border-emerald-400 bg-emerald-200"
          : isDarkMode
            ? "border-slate-600 bg-slate-700"
            : "border-slate-300 bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full transition ${checked ? "translate-x-6 bg-emerald-500" : "translate-x-1 bg-white"}`} />
    </button>
  );
}

function extractRepoName(repoSshUrl) {
  const raw = String(repoSshUrl || "").trim();
  const match = raw.match(/^[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
  if (match) return match[2];
  const slash = raw.lastIndexOf("/");
  const name = slash >= 0 ? raw.slice(slash + 1) : raw;
  return name.replace(/\.git$/, "") || raw;
}

function sanitizeTimeInput(value) {
  return String(value || "").trim().slice(0, 5);
}

function isValidLocalTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function resolveScheduleSlot(item) {
  if (item?.day_of_week !== null && item?.day_of_week !== undefined && item?.time_local) {
    const minutes = timeToMinutes(item.time_local);
    if (minutes >= 0) return { dayOfWeek: Number(item.day_of_week), timeLocal: item.time_local, minutes };
  }

  const cron = String(item?.cron_expr || "").trim();
  const parts = cron.split(/\s+/);
  if (parts.length >= 5) {
    const minute = Number(parts[0]);
    const hour = Number(parts[1]);
    const dayOfWeek = Number(parts[4]);
    if (Number.isInteger(minute) && Number.isInteger(hour) && Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6) {
      const minutes = hour * 60 + minute;
      if (minutes >= 0 && minutes < 1440) {
        return { dayOfWeek, timeLocal: minutesToTime(minutes), minutes };
      }
    }
  }
  return null;
}

function timeToMinutes(value) {
  const text = sanitizeTimeInput(value);
  if (!isValidLocalTime(text)) return -1;
  const [hour, minute] = text.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes) {
  const safe = Math.max(0, Math.min(1439, Number(totalMinutes) || 0));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError && typeof err.detail === "string") return err.detail || fallback;
  return err?.message || fallback;
}
