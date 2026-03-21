import { VocationType } from '@cs-rio/shared';
import {
  formatUniversityCurrency,
  formatUniversityDurationHours,
  formatUniversityRemaining,
  formatUniversityRequirements,
  formatUniversityVocation,
  getLiveUniversityCourseState,
  resolveUniversityCourseStateLabel,
  sortUniversityCourses,
  summarizeUniversityPassives,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, ProgressBar } from '../components/ui';
import { universityApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function UniversityScreen(): JSX.Element {
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof universityApi.getCenter>> | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);

  const sortedCourses = useMemo(
    () => sortUniversityCourses(center?.courses ?? []),
    [center?.courses],
  );
  const selectedCourse = useMemo(
    () => sortedCourses.find((course) => course.code === selectedCourseCode) ?? center?.activeCourse ?? sortedCourses[0] ?? null,
    [center?.activeCourse, selectedCourseCode, sortedCourses],
  );
  const activeCourse = useMemo(() => {
    if (!center?.activeCourse) {
      return null;
    }

    return {
      ...center.activeCourse,
      ...getLiveUniversityCourseState(center.activeCourse, nowMs),
    };
  }, [center?.activeCourse, nowMs]);
  const passiveLines = useMemo(
    () => summarizeUniversityPassives(center?.passiveProfile ?? nullPassiveProfile()),
    [center?.passiveProfile],
  );

  useEffect(() => {
    void loadCenter();
  }, []);

  useEffect(() => {
    if (!activeCourse) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeCourse]);

  useEffect(() => {
    if (!sortedCourses.length) {
      return;
    }

    if (!selectedCourseCode || !sortedCourses.some((course) => course.code === selectedCourseCode)) {
      const nextCourseCode = center?.activeCourse?.code ?? sortedCourses[0]?.code ?? null;

      if (nextCourseCode) {
        setSelectedCourseCode(nextCourseCode);
      }
    }
  }, [center?.activeCourse?.code, selectedCourseCode, sortedCourses]);

  async function loadCenter(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await universityApi.getCenter();
      setCenter(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a universidade.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEnroll(): Promise<void> {
    if (!selectedCourse) {
      return;
    }

    if (selectedCourse.isCompleted || selectedCourse.isInProgress || selectedCourse.lockReason) {
      setError(selectedCourse.lockReason ?? 'Esse curso nao pode ser iniciado agora.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      await universityApi.enroll({
        courseCode: selectedCourse.code,
      });
      await Promise.all([loadCenter(), refreshPlayerProfile()]);
      setFeedback(`${selectedCourse.label} iniciado. Duracao ${formatUniversityDurationHours(selectedCourse.durationHours)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao iniciar o curso.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={() => navigate('/vocation')} variant="secondary">
              Gerir vocacao
            </Button>
            <Button onClick={() => void loadCenter()} variant="ghost">
              {isLoading ? 'Sincronizando...' : 'Atualizar estudos'}
            </Button>
          </>
        }
        badges={[
          { label: formatUniversityVocation(center?.player.vocation ?? player?.vocation ?? VocationType.Cria), tone: 'info' },
          { label: `${center?.completedCourseCodes.length ?? 0} concluidos`, tone: 'success' },
          { label: `${passiveLines.length} passivos`, tone: 'warning' },
        ]}
        description="Estude, libere passivos e acompanhe sua trilha de vocacao com clareza."
        title="Estudar"
      />

      {feedback ? <FeedbackCard message={feedback} title="Universidade atualizada" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha na universidade" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Caixa" tone="warning" value={formatUniversityCurrency(center?.player.resources.money ?? player?.resources.money ?? 0)} />
        <MetricCard label="Vocacao" tone="info" value={formatUniversityVocation(center?.player.vocation ?? player?.vocation ?? VocationType.Cria)} />
        <MetricCard label="Ativo" tone={activeCourse ? 'warning' : 'neutral'} value={activeCourse ? 'Em andamento' : 'Livre'} />
        <MetricCard label="Passivos" tone="success" value={`${passiveLines.length}`} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Cursos</h3>
            <Badge tone="neutral">{sortedCourses.length} materias</Badge>
          </div>
          <div className="desktop-scroll-list">
            {sortedCourses.map((course) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedCourse?.code === course.code ? 'desktop-list-row--active' : ''}`}
                key={course.code}
                onClick={() => setSelectedCourseCode(course.code)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{course.label}</strong>
                  <Badge tone={resolveCourseTone(course)}>
                    {resolveUniversityCourseStateLabel(course)}
                  </Badge>
                </div>
                <small>{formatUniversityVocation(course.vocation)} · nivel {course.unlockLevel}</small>
                <small>{formatUniversityCurrency(course.moneyCost)} · {formatUniversityDurationHours(course.durationHours)}</small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          {selectedCourse ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <div>
                  <h3>{selectedCourse.label}</h3>
                  <p>{formatUniversityVocation(selectedCourse.vocation)} · desbloqueio no nivel {selectedCourse.unlockLevel}</p>
                </div>
                <Button
                  disabled={Boolean(activeCourse) || isMutating || selectedCourse.isCompleted || selectedCourse.isInProgress || Boolean(selectedCourse.lockReason)}
                  onClick={() => void handleEnroll()}
                  variant={selectedCourse.lockReason || selectedCourse.isCompleted ? 'ghost' : 'primary'}
                >
                  {isMutating ? 'Processando...' : 'Iniciar curso'}
                </Button>
              </div>
              <div className="desktop-grid-3">
                <MetricCard label="Duracao" tone="info" value={formatUniversityDurationHours(selectedCourse.durationHours)} />
                <MetricCard label="Custo" tone="warning" value={formatUniversityCurrency(selectedCourse.moneyCost)} />
                <MetricCard label="Estado" tone="success" value={resolveUniversityCourseStateLabel(selectedCourse)} />
              </div>
              <div className="desktop-detail-list">
                <div>
                  <strong>Requisitos</strong>
                  <small>{formatUniversityRequirements(selectedCourse.attributeRequirements)}</small>
                </div>
                <div>
                  <strong>Passivo</strong>
                  <small>{selectedCourse.effectSummary}</small>
                </div>
                <div>
                  <strong>Status</strong>
                  <small>{selectedCourse.lockReason ?? 'Curso pronto para iniciar.'}</small>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Curso ativo</h3>
              <Badge tone={activeCourse ? 'warning' : 'neutral'}>
                {activeCourse ? 'Em curso' : 'Nenhum'}
              </Badge>
            </div>
            {activeCourse ? (
              <>
                <ProgressBar
                  label={activeCourse.label}
                  tone="info"
                  value={Math.round(activeCourse.progressRatio * 100)}
                />
                <div className="desktop-grid-3">
                  <MetricCard label="Restante" tone="info" value={formatUniversityRemaining(activeCourse.remainingSeconds)} />
                  <MetricCard label="Duracao" tone="warning" value={formatUniversityDurationHours(activeCourse.durationHours)} />
                  <MetricCard label="Vocacao" tone="success" value={formatUniversityVocation(activeCourse.vocation)} />
                </div>
                <div className="desktop-detail-list">
                  <div>
                    <strong>Passivo em liberacao</strong>
                    <small>{activeCourse.effectSummary}</small>
                  </div>
                  <div>
                    <strong>Fechamento</strong>
                    <small>{activeCourse.endsAt ? new Date(activeCourse.endsAt).toLocaleString('pt-BR') : '--'}</small>
                  </div>
                </div>
              </>
            ) : (
              <p>Nenhum curso em andamento. Escolha uma materia no catalogo para iniciar a progressao.</p>
            )}
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Passivos ativos</h3>
              <Badge tone="success">{passiveLines.length}</Badge>
            </div>
            <div className="desktop-detail-list">
              {(passiveLines.length ? passiveLines : ['Sem passivo relevante liberado ainda.']).map((line) => (
                <div key={line}>
                  <strong>Bonus</strong>
                  <small>{line}</small>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function resolveCourseTone(
  course: Awaited<ReturnType<typeof universityApi.getCenter>>['courses'][number],
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  if (course.isCompleted) {
    return 'success';
  }

  if (course.isInProgress) {
    return 'warning';
  }

  if (course.lockReason) {
    return 'danger';
  }

  return 'info';
}

function nullPassiveProfile() {
  return {
    business: {
      bocaDemandMultiplier: 1,
      gpRevenueMultiplier: 1,
      launderingReturnMultiplier: 1,
      passiveRevenueMultiplier: 1,
      propertyMaintenanceMultiplier: 1,
    },
    crime: {
      arrestChanceMultiplier: 1,
      lowLevelSoloRewardMultiplier: 1,
      revealsTargetValue: false,
      soloSuccessMultiplier: 1,
    },
    factory: {
      extraDrugSlots: 0,
      productionMultiplier: 1,
    },
    faction: {
      factionCharismaAura: 0,
    },
    market: {
      feeRate: 0,
    },
    police: {
      bribeCostMultiplier: 1,
      negotiationSuccessMultiplier: 1,
    },
    social: {
      communityInfluenceMultiplier: 1,
    },
  };
}
