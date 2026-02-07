from arxiv_reciver.main import get_article
from Linkedin import FazerPost
from Escritor import gerar_post
from post_scheduler.main import exec_scheduler
from shared import ExecutionStateStore, configure_logging, log_event
from time import sleep
from datetime import datetime
import logging
import traceback


POLL_SECONDS = 30


if __name__ == "__main__":
    logger = configure_logging()
    state_store = ExecutionStateStore()
    log_event(
        logger,
        logging.INFO,
        "service_start",
        started_at=datetime.now().isoformat(timespec="seconds"),
        poll_seconds=POLL_SECONDS,
    )

    # Loop principal para checar agenda e publicar posts.
    while True:
        sleep(POLL_SECONDS)
        loop_started = datetime.now()
        loop_minute = loop_started.strftime("%Y-%m-%d %H:%M")
        log_event(logger, logging.INFO, "scheduler_check_start", minute=loop_minute)

        try:
            exec_config = exec_scheduler()
        except Exception as exc:
            log_event(
                logger,
                logging.ERROR,
                "scheduler_check_failed",
                minute=loop_minute,
                error=str(exc),
                traceback=traceback.format_exc(),
            )
            continue

        matches = exec_config.get("matches", [])
        scheduler_minute = exec_config.get("minute", loop_minute)
        if not exec_config.get("found"):
            log_event(logger, logging.INFO, "scheduler_no_match", minute=loop_minute)
            continue

        state_store.refresh()

        for schedule in matches:
            user = schedule["user"]
            topic = schedule["topic"]
            scheduled_time = schedule["time"]

            if state_store.was_processed(scheduler_minute, user, topic):
                log_event(
                    logger,
                    logging.WARNING,
                    "schedule_skipped_duplicate",
                    minute=loop_minute,
                    user=user,
                    topic=topic,
                    schedule_time=scheduled_time,
                )
                continue

            log_event(
                logger,
                logging.INFO,
                "schedule_processing_start",
                minute=loop_minute,
                user=user,
                topic=topic,
                schedule_time=scheduled_time,
            )

            try:
                # Busca o Artigo
                article_started = datetime.now()
                articles = get_article(
                    topics=[topic],
                    per_topic=1,
                    save_in_file=True,
                )
                articles_for_topic = articles.get(topic, [])
                if not articles_for_topic:
                    log_event(
                        logger,
                        logging.WARNING,
                        "article_not_found",
                        minute=loop_minute,
                        user=user,
                        topic=topic,
                    )
                    continue
                log_event(
                    logger,
                    logging.INFO,
                    "article_found",
                    minute=loop_minute,
                    user=user,
                    topic=topic,
                    article_count=len(articles_for_topic),
                    fetch_ms=int((datetime.now() - article_started).total_seconds() * 1000),
                )

                # Escreve o texto do Post
                writer_started = datetime.now()
                texto_post = gerar_post(str(articles_for_topic))
                if not texto_post:
                    log_event(
                        logger,
                        logging.ERROR,
                        "post_generation_failed",
                        minute=loop_minute,
                        user=user,
                        topic=topic,
                    )
                    continue
                log_event(
                    logger,
                    logging.INFO,
                    "post_generated",
                    minute=loop_minute,
                    user=user,
                    topic=topic,
                    post_chars=len(texto_post),
                    writer_ms=int((datetime.now() - writer_started).total_seconds() * 1000),
                )

                # Publica no LinkedIn
                linkedin_started = datetime.now()
                posted = FazerPost(texto_post, user)
                if not posted:
                    log_event(
                        logger,
                        logging.ERROR,
                        "linkedin_post_failed",
                        minute=loop_minute,
                        user=user,
                        topic=topic,
                    )
                    continue

                state_store.mark_processed(scheduler_minute, user, topic)
                log_event(
                    logger,
                    logging.INFO,
                    "linkedin_post_success",
                    minute=loop_minute,
                    user=user,
                    topic=topic,
                    linkedin_ms=int((datetime.now() - linkedin_started).total_seconds() * 1000),
                    total_ms=int((datetime.now() - loop_started).total_seconds() * 1000),
                )
            except Exception as exc:
                log_event(
                    logger,
                    logging.ERROR,
                    "schedule_processing_failed",
                    minute=loop_minute,
                    user=user,
                    topic=topic,
                    schedule_time=scheduled_time,
                    error=str(exc),
                    traceback=traceback.format_exc(),
                )
