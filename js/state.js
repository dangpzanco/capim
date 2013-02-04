/**
 * @constructor
 */
function Plano(n)
{
    var self = this;

    self.index = n;
    self.nome = "Plano " + (n + 1);
    self.cleanup();
}
Plano.prototype.cleanup = function() {
    this.combinacoes = new Combinacoes();
    this.materias    = new Materias();
}

/**
 * @constructor
 */
function State()
{
    var self = this;

    self.reset = function() {
        self.planos = [];
        self.planos.push(new Plano(0));
        self.planos.push(new Plano(1));
        self.planos.push(new Plano(2));
        self.planos.push(new Plano(3));
        self.index  = 0;
        self.plano  = self.planos[self.index];
        self.campus = "FLO";
        self.semestre = "20122";
    }
    self.reset();

    self.copy_plano = function(plano) {
        var state_plano = new Object();
        var list = plano.materias.list();
        state_plano.combinacao = plano.combinacoes.current();
        state_plano.materias   = new Array();
        state_plano.materia    = plano.materias.selected
        for (var i = 0; i < list.length; i++) {
            var state_materia = new Object();
            var materia = list[i];
            state_materia.codigo   = materia.codigo.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/&/g,"&amp;");
            state_materia.nome     = materia.nome.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/&/g,"&amp;");
            state_materia.cor      = materia.cor;
            state_materia.campus   = materia.campus;
            state_materia.semestre = materia.semestre;
            state_materia.turmas   = new Array();
            for (var j = 0; j < materia.turmas.length; j++) {
                var state_turma = new Object();
                var turma = materia.turmas[j];
                state_turma.nome             = turma.nome;
                state_turma.horas_aula       = turma.horas_aula;
                state_turma.vagas_ofertadas  = turma.vagas_ofertadas;
                state_turma.vagas_ocupadas   = turma.vagas_ocupadas;
                state_turma.alunos_especiais = turma.alunos_especiais;
                state_turma.saldo_vagas      = turma.saldo_vagas;
                state_turma.pedidos_sem_vaga = turma.pedidos_sem_vaga;
                state_turma.professores      = new Array();
                for (var k = 0; k < turma.professores.length; k++)
                    state_turma.professores.push(turma.professores[k]);
                state_turma.horarios         = new Array();
                for (var k = 0; k < turma.aulas.length; k++)
                    state_turma.horarios.push(turma.aulas[k].toString());
                state_turma.selected         = turma.selected;
                state_materia.turmas.push(state_turma);
            }
            state_materia.agrupar  = materia.agrupar;
            state_materia.selected = materia.selected;
            state_plano.materias.push(state_materia);
        }
        return state_plano;
    }

    self.save = function() {
        var state_to_return = new Object();
        state_to_return.versao = 5;
        state_to_return.campus = self.campus;
        state_to_return.semestre = self.semestre;
        state_to_return.planos = new Array();
        state_to_return.plano  = self.index;
        for (var p = 0; p < self.planos.length; p++) {
            var state_plano = self.copy_plano(self.planos[p]);
            state_to_return.planos.push(state_plano);
        }
        return JSON.stringify(state_to_return);
    };

    self.new_plano = function(plano_to_load, n) {
        var plano = new Plano(n);
        plano.materias.selected = plano_to_load.materia;
        /* não deveria ser necessário o parseInt aqui mas, por causa de um bug
         * no código, vários horários foram salvos com a combinação como
         * string. */
        plano.combinacao        = parseInt(plano_to_load.combinacao);
        for (var i = 0; i < plano_to_load.materias.length; i++) {
            var materia = plano.materias.add_json(plano_to_load.materias[i], self.campus, self.semestre);
            if (!materia)
                return -1;
            materia.codigo = materia.codigo.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
            materia.nome   = materia.nome.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
        }
        return plano;
    };

    self.load = function(state_to_load) {
        if (state_to_load.versao > 5)
            return -2;

        self.campus = state_to_load.campus;
        self.semestre = state_to_load.semestre;
        self.planos = [];

        for (var p = 0; p < state_to_load.planos.length; p++) {
            var plano = self.new_plano(state_to_load.planos[p], p);
            if (plano == -1)
                return -1;
            self.planos.push(plano);
        }
        if (!self.planos[0])
            self.planos[0] = new Plano(1);
        var plano_to_load = state_to_load.plano;
        if (plano_to_load < 0 || plano_to_load > self.planos.length || !plano_to_load)
            plano_to_load = 0;
        self.index = plano_to_load;
        self.plano = self.planos[plano_to_load];
        return 0;
    };

    self.set_plano = function(plano) {
        var i = 0;
        if (plano)
            for (; i < self.planos.length; i++)
                if (self.planos[i] == plano)
                    break;
        self.index = i;
        self.plano = self.planos[self.index];
    };

    self.issues = function(database, callback_yes, callback_no) {
        var issues = [];
        var materias = self.plano.materias.list();
        for (var i = 0; i < materias.length; i++) {
            var m_issues = [];
            m_issues.materia = materias[i];
            var state_materia = materias[i];
            var db_materia;
            if (database.db[state_materia.semestre] &&
                database.db[state_materia.semestre][state_materia.campus])
                db_materia = database.db[state_materia.semestre][state_materia.campus][state_materia.codigo];
            if (!db_materia) {
                if (/^[A-Z]{3}[0-9]{4}$/.test(state_materia.codigo) &&
                   !/^XXX[0-9]{4}$/.test(state_materia.codigo)) {
                    var issue = {};
                    issue.text = "Matéria não existe mais";
                    issue.button = "Remover matéria";
                    issue.action = function(materia) {
                        return function() {
                            self.plano.materias.remove_item(materia);
                        };
                    }(state_materia);
                    m_issues.push(issue);
                    issues.push(m_issues);
                }
                continue;
            }
            db_materia = new Materia(db_materia);
            for (var j = 0; j < state_materia.turmas.length; j++) {
                var state_turma = state_materia.turmas[j];
                state_turma.order_aulas();
                var db_turma = null;
                for (var k = 0; k < db_materia.turmas.length; k++) {
                    if (state_turma.nome == db_materia.turmas[k].nome) {
                        db_turma = db_materia.turmas[k];
                        break;
                    }
                }
                if (!db_turma) {
                    if (state_turma.nome.length != 4) {
                        var issue = {};
                        issue.text = "Turma " + state_turma.nome + " não existe mais!";
                        issue.button = "Remover turma";
                        issue.action = function(materia, turma) {
                            return function() {
                                self.plano.materias.remove_turma(materia, turma);
                            };
                        }(state_materia, state_turma);
                        m_issues.push(issue);
                    }
                    continue;
                }
                state_turma.horas_aula       = db_turma.horas_aula;
                state_turma.vagas_ofertadas  = db_turma.vagas_ofertadas;
                state_turma.vagas_ocupadas   = db_turma.vagas_ocupadas;
                state_turma.alunos_especiais = db_turma.alunos_especiais;
                state_turma.saldo_vagas      = db_turma.saldo_vagas;
                state_turma.pedidos_sem_vaga = db_turma.pedidos_sem_vaga;
                if (JSON.stringify(state_turma.professores) != JSON.stringify(db_turma.professores)) {
                    var issue = {};
                    issue.text = "Turma " + state_turma.nome + ": mudança de professores.";
                    issue.text_from = "";
                    for (var p = 0; p < state_turma.professores.length; p++) {
                        if (p) issue.text_from += ", ";
                        issue.text_from += state_turma.professores[p];
                    }
                    issue.text_to = "";
                    for (var p = 0; p < db_turma.professores.length; p++) {
                        if (p) issue.text_to += ", ";
                        issue.text_to += db_turma.professores[p];
                    }
                    issue.button = "Corrigir professores";
                    issue.action = function(turma, professores) {
                        return function() {
                            turma.professores = professores;
                        };
                    }(state_turma, JSON.parse(JSON.stringify(db_turma.professores)));
                    m_issues.push(issue);
                }
                for (var k = 0; k < state_turma.aulas.length; k++) {
                    if ((state_turma.aulas[k].dia  != db_turma.aulas[k].dia ) ||
                        (state_turma.aulas[k].hora != db_turma.aulas[k].hora)) {
                        var issue = {};
                        issue.text = "Turma " + state_turma.nome + ": horários de aula mudaram.";
                        issue.button = "Corrigir horários de aula";
                        issue.action = function(turma, aulas) {
                            return function() {
                                turma.aulas = aulas;
                                turma.materia.fix_horarios();
                            };
                        }(state_turma, db_turma.aulas);
                        m_issues.push(issue);
                        break;
                    }
                }
                db_materia.turmas.splice(db_materia.turmas.indexOf(db_turma), 1);
            }
            for (var j = 0; j < db_materia.turmas.length; j++) {
                var db_turma = db_materia.turmas[j];
                var issue = {};
                issue.text = "Turma " + db_turma.nome + " é nova!";
                issue.button = "Adicionar turma";
                issue.action = function(materia, turma) {
                    return function() {
                        self.plano.materias.update_add_turma(materia, turma);
                    };
                }(state_materia, db_turma);
                m_issues.push(issue);
            }
            if (m_issues[0])
                issues.push(m_issues);
        }
        if (issues[0])
            callback_yes(issues);
        else
            callback_no();
    };
}
