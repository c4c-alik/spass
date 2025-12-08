<template>
  <div ref="iconWrapper" class="icon-wrapper">
    <svg
      v-if="svgContent"
      class="icon"
      :class="className"
      :width="width"
      :height="height"
      :style="style"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
      v-html="innerContent"
    ></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  width: {
    type: [String, Number],
    default: 16
  },
  height: {
    type: [String, Number],
    default: 16
  },
  className: {
    type: String,
    default: ''
  },
  style: {
    type: Object,
    default: () => ({})
  },
  title: {
    type: String,
    default: ''
  }
})

const svgContent = ref('')
const innerContent = ref('')
const iconWrapper = ref<HTMLElement | null>(null)
let tooltipElement: HTMLElement | null = null

// 图标映射表
const iconMap: Record<string, string> = {
  check: '/src/assets/icons/check.svg',
  clock: '/src/assets/icons/clock.svg',
  cog: '/src/assets/icons/cog.svg',
  copy: '/src/assets/icons/copy.svg',
  'credit-card': '/src/assets/icons/credit-card.svg',
  dice: '/src/assets/icons/dice.svg',
  edit: '/src/assets/icons/edit.svg',
  'eye-off': '/src/assets/icons/eye-off.svg',
  eye: '/src/assets/icons/eye.svg',
  globe: '/src/assets/icons/globe.svg',
  key: '/src/assets/icons/key.svg',
  lock: '/src/assets/icons/lock.svg',
  link: '/src/assets/icons/link.svg',
  menu: '/src/assets/icons/menu.svg',
  mobile: '/src/assets/icons/mobile.svg',
  network: '/src/assets/icons/network.svg',
  plus: '/src/assets/icons/plus.svg',
  'plus-circle': '/src/assets/icons/plus-circle.svg',
  search: '/src/assets/icons/search.svg',
  shield: '/src/assets/icons/shield.svg',
  'sign-out': '/src/assets/icons/sign-out.svg',
  'star-filled': '/src/assets/icons/star-filled.svg',
  star: '/src/assets/icons/star.svg',
  sync: '/src/assets/icons/sync.svg',
  trash: '/src/assets/icons/trash.svg',
  user: '/src/assets/icons/user.svg',
  x: '/src/assets/icons/x.svg',
  'file-import': '/src/assets/icons/file-import.svg',
  'file-export': '/src/assets/icons/file-export.svg',
  'cloud-upload': '/src/assets/icons/cloud-upload.svg'
}

const loadIcon = async (): Promise<void> => {
  try {
    const iconName = props.name
    if (!iconMap[iconName]) {
      console.warn(`Icon "${iconName}" not found in icon map`)
      return
    }

    const response = await fetch(iconMap[iconName])
    const svgText = await response.text()

    // 提取SVG内容（去除svg标签本身）
    const match = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
    if (match && match[1]) {
      // 移除原始SVG中的width和height属性，让CSS控制大小
      let cleanedSvgContent = svgText.replace(/width="[^"]*"/, '').replace(/height="[^"]*"/, '')
      svgContent.value = cleanedSvgContent
      innerContent.value = match[1]
    }
  } catch (error) {
    console.error(`Failed to load icon: ${props.name}`, error)
  }
}

watch(() => props.name, loadIcon, { immediate: true })

function createTooltip(): void {
  if (!tooltipElement) {
    tooltipElement = document.createElement('div')
    tooltipElement.className = 'icon-tooltip'
    tooltipElement.innerHTML = `
      <div class="tooltip-content">${props.title}</div>
      <div class="tooltip-arrow"></div>
    `
    document.body.appendChild(tooltipElement)

    // 添加样式
    const style = document.createElement('style')
    style.textContent = `
      .icon-tooltip {
        position: fixed;
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .icon-tooltip.show {
        opacity: 1;
      }

      .tooltip-arrow {
        position: absolute;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid rgba(0, 0, 0, 0.9);
      }

      .icon-tooltip.top .tooltip-arrow {
        top: auto;
        bottom: -6px;
        border-bottom: none;
        border-top: 6px solid rgba(0, 0, 0, 0.9);
      }
    `
    document.head.appendChild(style)
  }
}

function showTooltip(): void {
  if (!props.title) return

  createTooltip()

  if (!iconWrapper.value || !tooltipElement) return

  const rect = iconWrapper.value.getBoundingClientRect()
  tooltipElement.querySelector('.tooltip-content')!.textContent = props.title
  tooltipElement.classList.add('show')

  // 计算tooltip位置
  const tooltipRect = tooltipElement.getBoundingClientRect()
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2
  let top = rect.bottom + 8

  // 确保tooltip不会超出视口边界
  const padding = 8
  let positionClass = ''

  if (left < padding) {
    left = padding
  } else if (left + tooltipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tooltipRect.width - padding
  }

  if (top + tooltipRect.height > window.innerHeight - padding) {
    top = rect.top - tooltipRect.height - 8
    positionClass = 'top'
  }

  tooltipElement.style.left = `${left}px`
  tooltipElement.style.top = `${top}px`
  tooltipElement.className = `icon-tooltip show ${positionClass}`
}

function hideTooltip(): void {
  if (tooltipElement) {
    tooltipElement.classList.remove('show')
  }
}

onBeforeUnmount(() => {
  if (tooltipElement) {
    tooltipElement.remove()
  }
})
</script>

<style scoped>
.icon-wrapper {
  display: inline-block;
}

.icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  display: inline-block;
  vertical-align: middle;
}
</style>
