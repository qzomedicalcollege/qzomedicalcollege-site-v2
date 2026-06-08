const specialties = {
  nursing: {
    title: 'Сестринское дело',
    subtitle: 'Подготовка медицинских сестёр для клинической практики, ухода и профилактики.',
    icon: '🩺', duration: '2 г. 10 мес. / 3 г. 10 мес.', qualification: 'Медицинская сестра / медицинский брат', form: 'Очная', basis: 'После 9 / 11 класса',
    text: 'Программа направлена на подготовку специалистов среднего медицинского звена, способных выполнять сестринский уход, участвовать в профилактике заболеваний, сопровождать пациента и работать в составе медицинской команды.'
  },
  medical: {
    title: 'Лечебное дело', subtitle: 'Подготовка фельдшеров для первичной медико-санитарной помощи.', icon: '⚕️', duration: '3 г. 10 мес.', qualification: 'Фельдшер', form: 'Очная', basis: 'После 9 / 11 класса',
    text: 'Обучение включает основы диагностики, неотложной помощи, профилактики, ухода за пациентом и практическую подготовку на клинических базах.'
  },
  midwifery: {
    title: 'Акушерское дело', subtitle: 'Охрана здоровья матери и ребёнка.', icon: '🤱', duration: '2 г. 10 мес.', qualification: 'Акушер(ка)', form: 'Очная', basis: 'После 9 / 11 класса',
    text: 'Программа охватывает сопровождение беременности, родов, послеродового периода, профилактику осложнений и работу с женщинами и новорождёнными.'
  },
  pharmacy: {
    title: 'Фармация', subtitle: 'Лекарственное обеспечение и работа аптечных организаций.', icon: '💊', duration: '2 г. 10 мес.', qualification: 'Фармацевт', form: 'Очная', basis: 'После 9 / 11 класса',
    text: 'Студенты изучают основы фармакологии, лекарственных средств, хранения, учёта и консультирования в аптечной практике.'
  },
  lab: {
    title: 'Лабораторная диагностика', subtitle: 'Лабораторные исследования и анализы.', icon: '🔬', duration: '2 г. 10 мес.', qualification: 'Медицинский лабораторный техник / лаборант', form: 'Очная', basis: 'После 9 / 11 класса',
    text: 'Направление связано с лабораторными исследованиями, подготовкой проб, работой с оборудованием и контролем качества анализов.'
  },
  dentistry: {
    title: 'Стоматология', subtitle: 'Базовая подготовка для стоматологического направления.', icon: '🦷', duration: 'по программе', qualification: 'Квалификация зависит от образовательной программы', form: 'Очная', basis: 'После 9 / 11 класса',
    text: 'Раздел предназначен для описания стоматологического направления, ассистирования, профилактики и практических навыков.'
  }
};
function escapeHTML(value) { const div = document.createElement('div'); div.textContent = value ?? ''; return div.innerHTML; }
const params = new URLSearchParams(location.search);
const slug = params.get('slug') || 'nursing';
const item = specialties[slug] || specialties.nursing;
document.querySelector('[data-specialty-title]').textContent = item.title;
document.querySelector('[data-specialty-subtitle]').textContent = item.subtitle;
const root = document.querySelector('[data-specialty-detail]');
root.innerHTML = `
  <div class="specialty-detail-head"><div class="specialty-detail-icon">${item.icon}</div><div><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.subtitle)}</p></div></div>
  <div class="specialty-facts">
    <div><strong>${escapeHTML(item.duration)}</strong><span>Срок обучения</span></div>
    <div><strong>${escapeHTML(item.qualification)}</strong><span>Квалификация</span></div>
    <div><strong>${escapeHTML(item.form)}</strong><span>Форма обучения</span></div>
    <div><strong>${escapeHTML(item.basis)}</strong><span>База поступления</span></div>
  </div>
  <div class="detail-content"><p>${escapeHTML(item.text)}</p></div>
  <div class="post-actions-row"><a class="btn btn-primary" href="admission.html">Поступление</a><a class="btn btn-secondary" href="documents.html">Документы</a></div>
`;
