export const ru = {
  taskList: {
    joinTeamFirst: "Сначала вступите в команду по invite-ссылке.",
    empty: "Пока пусто.",
    loadFailed: "Не удалось загрузить задачи."
  },
  dmTask: {
    notInWorkspace: "Вы еще не подключены к команде. Попросите invite-ссылку.",
    enterText: "Отправьте текст задачи одним сообщением."
  },
  groupTask: {
    needReply: "Ответьте на сообщение и отправьте /task.",
    prompt: "Создать задачу?",
    buttonCreate: "➕ Создать задачу",
    createFailed: "Не получилось подготовить задачу. Попробуйте еще раз."
  },
  startTask: {
    draftNotFound: "Черновик не найден.",
    alreadyExists: (taskId: string) => `Задача уже существует (id: ${taskId}).`,
    chooseAssignee: "Выберите исполнителя."
  },
  startJoin: {
    joinedTeam: (titleOrId: string) => `Вы в команде: ${titleOrId}`,
    invalidInvite: "Ссылка-приглашение недействительна или истекла."
  },
  common: {
    notImplemented: "Пока не реализовано.",
    taskNotFound: "Задача не найдена."
  }
} as const;
