$(function() {
  const APP = {
    templates: {},

    createTemplates: function() {
      let self = this;
      $("script[type='text/x-handlebars']").each(function() {
        let $tmpl = $(this);
        self.templates[$tmpl.attr('id')] = Handlebars.compile($tmpl.html());
      });

      $('[data-type="partial"]').each(function() {
        let $partial = $(this);
        Handlebars.registerPartial($partial.attr('id'), $partial.html());
      });
    },

    populateTodos: function(todos) {
      todosManager.todosList = todos;
      todosManager.calculateDueDates();
      UI.renderPage();
      UI.selectCategory($('#all_header'));
      UI.updateMain();
    },

    insertNewTodo: function(todo) {
      todosManager.todosList.push(todo);
      todosManager.calculateDueDates();
      UI.updateNav('#all_header');
      UI.updateMain();
    },

    updateTodo: function(updatedTodo) {
      todosManager.replaceTodo(updatedTodo);
      todosManager.calculateDueDates();
      UI.updateNav();
      UI.updateMain();
    },

    deleteTodo: function(todoId) {
      todosManager.removeTodo(todoId);
      UI.updateNav();
      UI.updateMain();
    },

    init: function() {
      this.createTemplates();
      API.retrieveTodos();
      UI.bindEvents();
    },
  };

  const API = (function() {
    function serializeFormData($form) {
      let formData = $form.serializeArray();
      let data = {};

      data['title'] = formData[0].value;
      data['day'] = formData[1].value !== 'Day' ? formData[1].value : '';
      data['month'] = formData[2].value !== 'Month' ? formData[2].value : '';
      data['year'] = formData[3].value !== 'Year' ? formData[3].value : '';
      data['description'] = formData[4].value;

      return data;
    }
    return {
      retrieveTodos: function() {
        $.ajax({
          url: '/api/todos',
          method: 'GET',
          type: 'JSON',
        }).done(function(json) {
          APP.populateTodos(json);
        });
      },

      addNewTodo: function() {
        let $form = $('form');
        let data = serializeFormData($form);
        $.ajax({
          url: $form.attr('action'),
          method: $form.attr('method'),
          dataType: 'JSON',
          data: data,
        }).done(function(json) {
          APP.insertNewTodo(json);
        });
      },

      updateTodo: function() {
        let $form = $('form');
        let data = serializeFormData($form);
        $.ajax({
          url: $form.attr('action'),
          method: $form.attr('method'),
          dataType: 'JSON',
          data: data,
        }).done(function(json) {
          APP.updateTodo(json);
        });
      },

      deleteTodo: function(todoId) {
        $.ajax({
          url: `/api/todos/${todoId}`,
          method: 'DELETE',
        }).done(function() {
          APP.deleteTodo(todoId);
        });
      },

      toggleTodoCompleted: function(todoId, newStatus) {
        $.ajax({
          url: `/api/todos/${todoId}`,
          method: 'PUT',
          data: `completed=${newStatus}`,
          dataType: 'JSON',
        }).done(function(json) {
          APP.updateTodo(json);
        });
      },

      markTodoComplete: function(todoId) {
        $.ajax({
          url: `/api/todos/${todoId}`,
          method: 'PUT',
          data: 'completed=true',
          dataType: 'json',
        }).done(function(json) {
          APP.updateTodo(json);
        });
      },
    };
  })();

  const UI = (function() {
    function selectMainCategory(e) {
      this.selectCategory($(e.currentTarget).find('header'));
      this.updateMain();
    }

    function selectSubCategory(e) {
      this.selectCategory($(e.currentTarget).closest('dl'));
      this.updateMain();
    }

    function populateForm(todo) {
      $('form')[0].reset()
      $('#title')[0].value = todo.title;
      $('#due_day')[0].value = todo.day || 'Day';
      $('#due_month')[0].value = todo.month || 'Month';
      $('#due_year')[0].value = todo.year || 'Year';
      if (todo.description) {
        $("textarea[name='description']")[0].value = todo.description;
      }
    }

    function updateTodo(e) {
      e.preventDefault();
      e.stopPropagation();
      let todoId = +$(e.target).closest('tr').attr('data-id');
      let todo = todosManager.findTodo(todoId);
      setFormAttr(`/api/todos/${todoId}`, 'put');
      populateForm(todo);
      showForm();
    }

    function checkTodoComplete(e) {
      let $todoItem = $(e.target).closest('td');
      let todoId = $(e.target).closest('tr').attr('data-id');
      let currentStatus = $todoItem.find('input').is(':checked');
      let newStatus = !currentStatus;
      API.toggleTodoCompleted(todoId, newStatus);
      $todoItem.find('input').prop('checked', newStatus);
    }

    function deleteTodo(e) {
      let todoId = +$(e.target).closest('tr').attr('data-id');
      API.deleteTodo(todoId);
    }

    function markTodoComplete(e) {
      e.preventDefault();
      let method = $('form').attr('method');
      if (method === 'post') {
        alert('Cannot mark as complete as item has not been created yet!');
      } else {
        let todoId = $('form').attr('action').match(/\d+/g)[0];
        hideForm();
        API.markTodoComplete(todoId);
      }
    }

    function showAddForm(e) {
      e.preventDefault();
      $('form')[0].reset()
      setFormAttr('api/todos', 'post');
      showForm();
    }

    function setFormAttr(url, method) {
      $('form').attr({
        action: url,
        method: method,
      });
    }

    function showForm() {
      $('.modal').fadeIn();
      $('#form_modal').css('top', '200px');
    }

    function isValidTitle(title) {
      return title.replace(/\s/g, '').length >= 3;
    }

    function hideForm() {
      setFormAttr('', '');
      $('.modal').fadeOut();
    }

    function submitForm(e) {
      e.preventDefault();
      let $form = $(e.target);
      let title = $form.find('input#title').val();

      if (isValidTitle(title)) {
        $form.attr('method') === 'put' ? API.updateTodo(): API.addNewTodo()
        hideForm();
      } else {
        alert('You must enter a title at least 3 characters long.');
      }
    }

    function pageTemplateData() {
      return {
        selected: todosManager.selectedTodos(),
        todos: todosManager.todosList,
        done: todosManager.allCompletedTodos(),
        todos_by_date: todosManager.organizeTodosByDate(todosManager.todosList),
        done_todos_by_date: todosManager.completedTodosByDate(),
        current_section: UI.selectedCategory,
      };
    }

    return {
      selectedCategory: {},

      bindEvents: function() {
        $(document).on('click', "label[for='new_item']", showAddForm);
        $(document).on('submit', 'form', submitForm);
        $(document).on('click', 'td.list_item label', updateTodo);
        $(document).on('click', 'td.delete', deleteTodo);
        $(document).on('click', "button[name='complete']", markTodoComplete);
        $(document).on('click', 'td.list_item', checkTodoComplete);
        $(document).on('click', '#modal_layer', hideForm);
        $(document).on('click', 'article dl', selectSubCategory.bind(this));
        $(document).on('click', 'section div', selectMainCategory.bind(this));
      },

      renderPage: function() {
        let templateData = pageTemplateData()
        let page = APP.templates.main_template(templateData);
        $('body').html(page);
        setFormAttr('', '');
      },

      updateMain: function() {
        let templateData = pageTemplateData();
        let header = APP.templates.title_template(templateData);
        let itemsBody = APP.templates.list_template(templateData)
        let numberOfItems = header.match(/<dd>\d<\/dd>/)[0].match(/\d+/)[0];

        if (Number(numberOfItems) === 0) {
          templateData.selected = [];
          itemsBody = APP.templates.list_template(templateData);
        }

        $('#items header').html(header);
        $('#items tbody').html(itemsBody);
      },

      updateNav: function(category) {
        let templateData = pageTemplateData();
        let allTodosDomElements = APP.templates.all_todos_template(templateData);
        let allListsDomElements = APP.templates.all_list_template(templateData);
        let completedTodosDomElements = APP.templates.completed_todos_template(templateData);
        let completedListsDomElements = APP.templates.completed_list_template(templateData);

        if (!category) {
          let parentList = UI.selectedCategory.$element.parent().attr('id');
          let title = UI.selectedCategory.$element.attr('data-title');
          category = `#${parentList} [data-title="${title}"]`;
        }

        $('#all_todos').html(allTodosDomElements);
        $('#all_lists').html(allListsDomElements);
        $('#completed_todos').html(completedTodosDomElements);
        $('#completed_lists').html(completedListsDomElements);
        this.selectCategory($(category));
      },

      selectCategory: function($element) {
        if ($element.length === 0) {
          this.selectedCategory.data = 0;
          return;
        }

        $('.active').removeClass('active');
        $element.addClass('active');
        this.selectedCategory.$element = $element;
        this.selectedCategory.title = $element.attr('data-title');
        this.selectedCategory.data = $element.attr('data-total');
      },
    };
  })();

  const todosManager = (function() {
    function incompleteTodos(todos) {
      return todos.filter(todo => !todo.completed);
    }

    function completedTodos(todos) {
      return todos.filter(todo => todo.completed);
    }

    function sortTodosByIncomplete(todos) {
      if (!todos) {
        return
      } else {
        return incompleteTodos(todos).concat(completedTodos(todos));
      }
    }

    function sortTodosByDate(todoSet) {
      return todoSet.sort((todo1, todo2) => {
        let todo1Year = Number(todo1.year);
        let todo2Year = Number(todo2.year);
        let todo1Month = Number(todo1.month);
        let todo2Month = Number(todo2.month);

        if (todo1Year < todo2Year) {
          return -1;
        } else if (todo1Year === todo2Year && todo1Month < todo2Month) {
          return -1;
        } else {
          return 1;
        }
      });
    }

    return {
      todosList: [],

      calculateDueDates: function() {
        this.todosList.forEach(todo => {
          if (todo.month && todo.year) {
            todo.due_date = `${todo.month}/${todo.year.slice(2)}`
          } else {
            todo.due_date = 'No Due Date';
          }
        });
      },

      organizeTodosByDate: function(todos) {
        let result = {};
        this.calculateDueDates();
        sortTodosByDate(todos).forEach(todo => {
          if (result[todo.due_date]) {
            result[todo.due_date].push(todo);
          } else {
            result[todo.due_date] = [];
            result[todo.due_date].push(todo);
          }
        });

        return result;
      },

      replaceTodo: function(updatedTodo) {
        let newTodosList = [];
        this.todosList.forEach(todo => {
          if (updatedTodo.id === todo.id) {
            newTodosList.push(updatedTodo);
          } else {
            newTodosList.push(todo);
          }
        });

        this.todosList = newTodosList;
      },

      allCompletedTodos: function() {
        return completedTodos(this.todosList);
      },

      completedTodosByDate: function() {
        let todosCompleted = completedTodos(this.todosList);
        return this.organizeTodosByDate(todosCompleted);
      },

      findTodo: function(todoId) {
        return this.todosList.find(todo => todo.id === todoId);
      },

      removeTodo: function(todoId) {
        this.todosList = this.todosList.filter(todo => {
          return todo.id !== todoId
        });
      },

      selectedTodos: function() {
        let $element = UI.selectedCategory.$element;
        let $elementParendId;
        let title = UI.selectedCategory.title || 'All Todos';

        if ($element) {$elementParentId = $element.parent().attr('id');}

        if (title === 'All Todos') {
          return sortTodosByIncomplete(this.todosList);
        } else if (title === 'Completed') {
          return completedTodos(this.todosList);
        } else if ($elementParentId === 'completed_lists') {
          let todosCompleted = completedTodos(this.todosList);
          let completedTodosByDate = this.organizeTodosByDate(todosCompleted);
          let todosForDate = completedTodosByDate[title] || [];
          return todosForDate;
        } else {
          let allTodosByDate = this.organizeTodosByDate(this.todosList);
          let todosForDate = allTodosByDate[title];
          return sortTodosByIncomplete(todosForDate);
        }
      },
    };
  })();

  APP.init();
});
