"use strict";

(function () {
  const TARGET_PATH = "/krp/main_page/home";
  const PANEL_ID = "krp-time-helper-panel";
  const COUNTED_WINDOWS = [
    [6 * 60, 12 * 60],
    [13 * 60, 18 * 60],
    [19 * 60, 24 * 60]
  ];
  const DAILY_COUNT_LIMIT_MINUTES = 12 * 60;
  const PANEL_EDGE_MARGIN = 16;
  const PANEL_VERTICAL_MARGIN = 8;
  let panelClosed = false;
  let panelMinimized = false;
  let panelPosition = null;

  function parseDuration(text) {
    if (!text) {
      return null;
    }

    const normalized = String(text).replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }

    const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (clockMatch) {
      const hours = Number(clockMatch[1]);
      const minutes = Number(clockMatch[2]);
      if (minutes >= 60) {
        return null;
      }
      return (hours * 60) + minutes;
    }

    const matches = [...normalized.matchAll(/(\d+)\s*([DHM])/gi)];
    if (!matches.length) {
      return null;
    }

    let totalMinutes = 0;
    for (const match of matches) {
      const value = Number(match[1]);
      const unit = match[2].toUpperCase();

      if (unit === "D") {
        totalMinutes += value * 24 * 60;
      } else if (unit === "H") {
        totalMinutes += value * 60;
      } else if (unit === "M") {
        totalMinutes += value;
      }
    }

    return totalMinutes;
  }

  function parseClockTime(text) {
    if (!text) {
      return null;
    }

    const match = String(text).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes >= 60) {
      return null;
    }
    if (hours === 24) {
      return minutes === 0 ? 24 * 60 : null;
    }
    if (hours < 0 || hours > 23) {
      return null;
    }

    return (hours * 60) + minutes;
  }

  function formatDuration(totalMinutes) {
    if (typeof totalMinutes !== "number" || Number.isNaN(totalMinutes) || totalMinutes < 0) {
      return null;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }

  function formatClockTime(minutesFromMidnight) {
    if (
      typeof minutesFromMidnight !== "number" ||
      Number.isNaN(minutesFromMidnight) ||
      minutesFromMidnight < 0 ||
      minutesFromMidnight > 24 * 60
    ) {
      return null;
    }

    const hours = Math.floor(minutesFromMidnight / 60);
    const minutes = minutesFromMidnight % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function countWeekdaysLeft(rootDocument) {
    const todayMarker = rootDocument.querySelector(".fc_day_top p.today");
    if (todayMarker) {
      const currentCell = todayMarker.closest(".fc_event_container");
      const weekContainer = todayMarker.closest(".fc_bg");

      if (currentCell && weekContainer) {
        const cells = [...weekContainer.querySelectorAll(".fc_event_container")];
        const currentIndex = cells.indexOf(currentCell);
        if (currentIndex >= 0) {
          return cells.length - currentIndex;
        }
      }
    }

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return 6 - dayOfWeek;
    }

    return null;
  }

  function addCountedMinutes(startTimeMinutes, targetMinutes) {
    if (
      typeof startTimeMinutes !== "number" ||
      Number.isNaN(startTimeMinutes) ||
      typeof targetMinutes !== "number" ||
      Number.isNaN(targetMinutes) ||
      targetMinutes < 0 ||
      targetMinutes > DAILY_COUNT_LIMIT_MINUTES
    ) {
      return null;
    }

    if (targetMinutes === 0) {
      return startTimeMinutes;
    }

    let remaining = targetMinutes;
    for (const [windowStart, windowEnd] of COUNTED_WINDOWS) {
      const effectiveStart = Math.max(startTimeMinutes, windowStart);
      if (effectiveStart >= windowEnd) {
        continue;
      }

      const available = windowEnd - effectiveStart;
      if (remaining <= available) {
        return effectiveStart + remaining;
      }

      remaining -= available;
    }

    return null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getPanelMaxCoordinates(panel) {
    return {
      left: Math.max(PANEL_EDGE_MARGIN, window.innerWidth - panel.offsetWidth - PANEL_EDGE_MARGIN),
      top: Math.max(PANEL_VERTICAL_MARGIN, window.innerHeight - panel.offsetHeight - PANEL_VERTICAL_MARGIN)
    };
  }

  function getSnappedLeft(panel, side) {
    if (side === "left") {
      return PANEL_EDGE_MARGIN;
    }

    return getPanelMaxCoordinates(panel).left;
  }

  function getTrimmedText(selector, rootDocument) {
    const element = rootDocument.querySelector(selector);
    return element ? element.textContent.trim() : "";
  }

  function collectPageData(rootDocument) {
    const remainingText = getTrimmedText(".work_remain_hr", rootDocument);
    const startText = getTrimmedText(".cul_time", rootDocument);
    const endText = getTrimmedText(".lvf_time", rootDocument);

    const remainingMinutes = parseDuration(remainingText);
    const startMinutes = parseClockTime(startText);
    const weekdaysLeft = countWeekdaysLeft(rootDocument);
    const averageMinutes =
      remainingMinutes != null && weekdaysLeft != null && weekdaysLeft > 0
        ? Math.ceil(remainingMinutes / weekdaysLeft)
        : null;
    const checkedIn = startMinutes != null && !endText;

    const goalFinishMinutes =
      checkedIn && remainingMinutes != null && remainingMinutes > 0
        ? addCountedMinutes(startMinutes, remainingMinutes)
        : null;

    const predictions = [];
    if (checkedIn) {
      for (let hours = 6; hours <= 12; hours += 1) {
        const targetMinutes = hours * 60;
        if (remainingMinutes != null && remainingMinutes > 0 && targetMinutes > remainingMinutes) {
          break;
        }

        const finishMinutes = addCountedMinutes(startMinutes, targetMinutes);
        if (finishMinutes != null) {
          predictions.push({
            label: `+${hours}H`,
            finishMinutes
          });
        }
      }
    }

    return {
      averageMinutes,
      checkedIn,
      endText,
      goalFinishMinutes,
      predictions,
      remainingMinutes,
      remainingText,
      startMinutes,
      startText,
      weekdaysLeft
    };
  }

  function buildRow(label, value, options) {
    const row = document.createElement("div");
    row.className = "krp-time-helper__row";
    if (options && options.emphasis) {
      row.classList.add("krp-time-helper__row--emphasis");
    }

    const labelNode = document.createElement("div");
    labelNode.className = "krp-time-helper__label";
    labelNode.textContent = label;

    const valueNode = document.createElement("div");
    valueNode.className = "krp-time-helper__value";
    if (options && options.muted) {
      valueNode.classList.add("krp-time-helper__value--muted");
    }
    valueNode.textContent = value;

    row.append(labelNode, valueNode);
    return row;
  }

  function buildEmpty(text) {
    const paragraph = document.createElement("p");
    paragraph.className = "krp-time-helper__empty";
    paragraph.textContent = text;
    return paragraph;
  }

  function buildControlButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `krp-time-helper__control ${options.className}`;
    button.title = options.title;
    button.setAttribute("aria-label", options.title);
    button.dataset.symbol = options.symbol;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      options.onClick();
    });
    return button;
  }

  function applyPanelPosition(panel) {
    if (panelPosition) {
      const maxCoordinates = getPanelMaxCoordinates(panel);
      const top = clamp(panelPosition.top, PANEL_VERTICAL_MARGIN, maxCoordinates.top);
      const left =
        panelPosition.mode === "snapped"
          ? getSnappedLeft(panel, panelPosition.side)
          : clamp(panelPosition.left, PANEL_EDGE_MARGIN, maxCoordinates.left);

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      return;
    }

    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("right");
    panel.style.removeProperty("bottom");
  }

  function startDragging(panel, pointerDownEvent) {
    if (pointerDownEvent.button !== 0) {
      return;
    }

    pointerDownEvent.preventDefault();

    const rect = panel.getBoundingClientRect();
    const offsetX = pointerDownEvent.clientX - rect.left;
    const offsetY = pointerDownEvent.clientY - rect.top;

    panel.classList.add("krp-time-helper--dragging");

    function handlePointerMove(moveEvent) {
      const maxCoordinates = getPanelMaxCoordinates(panel);

      panelPosition = {
        mode: "free",
        left: clamp(moveEvent.clientX - offsetX, PANEL_EDGE_MARGIN, maxCoordinates.left),
        top: clamp(moveEvent.clientY - offsetY, PANEL_VERTICAL_MARGIN, maxCoordinates.top)
      };

      applyPanelPosition(panel);
    }

    function stopDragging() {
      panel.classList.remove("krp-time-helper--dragging");
      const currentRect = panel.getBoundingClientRect();
      const maxCoordinates = getPanelMaxCoordinates(panel);
      const side =
        currentRect.left + (currentRect.width / 2) < (window.innerWidth / 2) ? "left" : "right";

      panelPosition = {
        mode: "snapped",
        side,
        top: clamp(currentRect.top, PANEL_VERTICAL_MARGIN, maxCoordinates.top)
      };
      applyPanelPosition(panel);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  }

  function buildTitlebar(panel) {
    const titlebar = document.createElement("div");
    titlebar.className = "krp-time-helper__titlebar";
    titlebar.addEventListener("pointerdown", function (event) {
      if (event.target.closest(".krp-time-helper__control")) {
        return;
      }

      startDragging(panel, event);
    });

    const trafficLights = document.createElement("div");
    trafficLights.className = "krp-time-helper__traffic-lights";
    trafficLights.append(
      buildControlButton({
        className: "krp-time-helper__control--close",
        title: "Close panel",
        symbol: "×",
        onClick: function () {
          panelClosed = true;
          const existingPanel = document.getElementById(PANEL_ID);
          if (existingPanel) {
            existingPanel.remove();
          }
        }
      }),
      buildControlButton({
        className: "krp-time-helper__control--minimize",
        title: panelMinimized ? "Expand panel" : "Minimize panel",
        symbol: panelMinimized ? "+" : "−",
        onClick: function () {
          panelMinimized = !panelMinimized;
          render();
        }
      })
    );

    const title = document.createElement("div");
    title.className = "krp-time-helper__title";
    title.textContent = "github.com/p51lee/kaist-agent-extension";

    titlebar.append(trafficLights, title);
    return titlebar;
  }

  function renderPanel(data) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
    }

    panel.classList.toggle("krp-time-helper--minimized", panelMinimized);
    applyPanelPosition(panel);
    panel.textContent = "";

    panel.appendChild(buildTitlebar(panel));

    if (panelMinimized) {
      return;
    }

    const inner = document.createElement("div");
    inner.className = "krp-time-helper__inner";

    const averageSection = document.createElement("section");
    averageSection.className = "krp-time-helper__section";

    if (data.averageMinutes != null) {
      averageSection.appendChild(
        buildRow("남은 평일 평균 필요 시간", formatDuration(data.averageMinutes))
      );
    } else {
      averageSection.appendChild(buildEmpty("평균 시간을 계산할 수 없습니다."));
    }

    inner.appendChild(averageSection);

    if (data.checkedIn) {
      const predictionSection = document.createElement("section");
      predictionSection.className = "krp-time-helper__section";

      if (data.goalFinishMinutes != null) {
        predictionSection.appendChild(
          buildRow("이번 주 40H 완료", formatClockTime(data.goalFinishMinutes))
        );
      }

      if (data.predictions.length) {
        for (const prediction of data.predictions) {
          predictionSection.appendChild(
            buildRow(
              prediction.label,
              formatClockTime(prediction.finishMinutes),
              { emphasis: prediction.label === "+8H" }
            )
          );
        }
      } else {
        predictionSection.appendChild(buildEmpty("도달 가능한 종료 시각이 없습니다."));
      }

      inner.appendChild(predictionSection);
    }

    const message = document.createElement("div");
    message.className = "krp-time-helper__message";
    message.textContent = "전문연 화이팅";
    inner.appendChild(message);

    panel.appendChild(inner);
  }

  function render() {
    if (!window.location.pathname.startsWith(TARGET_PATH)) {
      return;
    }

    if (!document.body) {
      return;
    }

    if (panelClosed) {
      const existingPanel = document.getElementById(PANEL_ID);
      if (existingPanel) {
        existingPanel.remove();
      }
      return;
    }

    const data = collectPageData(document);
    renderPanel(data);
  }

  function startObservers() {
    const observedNodes = [
      document.querySelector(".rsrchr_dclz_box"),
      document.querySelector(".all_content_cal")
    ].filter(Boolean);

    if (!observedNodes.length) {
      return;
    }

    let pending = false;
    const scheduleRender = function () {
      if (pending) {
        return;
      }

      pending = true;
      window.setTimeout(function () {
        pending = false;
        render();
      }, 50);
    };

    const observer = new MutationObserver(scheduleRender);
    for (const node of observedNodes) {
      observer.observe(node, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  function init() {
    render();
    startObservers();
    window.addEventListener("resize", function () {
      if (panelPosition) {
        render();
      }
    });
    window.setInterval(render, 60 * 1000);
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      addCountedMinutes,
      collectPageData,
      countWeekdaysLeft,
      formatClockTime,
      formatDuration,
      parseClockTime,
      parseDuration
    };
  }
})();
