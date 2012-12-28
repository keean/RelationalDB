// Relational Algebra Library for JavaScript
// Copyright 2010,2011,2012 Keean Schupke, All rights reserved
// Licensed under LGPL v3.0, see license.txt for terms.

var RelationalDataModel = function() {
    var this_rdm = this,
        name_regex = /^[A-Za-z][_0-9A-Za-z]*$/,
        freeze = Object.freeze;

    if (freeze === undefined) {
        freeze = function(a) {return a;};
    }

    //--------------------------------------------------------------------
    // Schema

    this.schema = {};

    //--------------------------------------------------------------------
    // Domains

    var Type = function(name, id) {
        this.id = id;
        this.name = name;
    }

    var TInteger = function() {}
    var TNumber = function() {}
    var TString = function() {}
    var TBoolean = function() {}

    var TEnum = function(values) {
        this.values = values;
    }

    var TDomain = function(name, type, qualifiers) {
        this.name = name;
        this.basetype = type;
        this.qualifiers = qualifiers;
    }

    TInteger.prototype = freeze(new Type('integer', TInteger));
    TNumber.prototype = freeze(new Type('number', TNumber));
    TString.prototype = freeze(new Type('string', TString));
    TBoolean.prototype = freeze(new Type('boolean', TBoolean));

    TEnum.prototype = freeze(new Type('enum', TEnum));

    TDomain.prototype = freeze(new Type('domain', TDomain));

    this.integer = freeze(new TInteger);
    this.number = freeze(new TNumber);
    this.string = freeze(new TString);
    this.boolean = freeze(new TBoolean);

    this.enum = function(values) {
        for (var key in values) if (values.hasOwnProperty(key)) {
            if (typeof(values[key]) !== 'string') {
                throw new TypeError("'" + key + "' has invalid enumeration label");
            }
        }

        return freeze(new TEnum(values));
    };

    function EnumValue(domain, value) {
        this.domain = domain;
        this.value = value;
    }

    EnumValue.prototype.toString = function() {
        return value;
    };

    this.domain = function(name, type, qualifiers) {
        if ((typeof(name) !== 'string') || (name.match(name_regex))) {
            throw new TypeError('invalid name');
        }

        if ((type.constructor !== Type) || (type.id !== TDomain)) {
            throw new TypeError('invalid type');
        }

        var d = new TDomain(name, type, qualifiers);
        if (type.id === TEnum) {
            d.values = {};
            for (var key in type.values) if (type.values.hasOwnProperty(key)) {
                d.values[key] = new EnumValue(d, type.values[key]);
            }
        }

        return freeze(d);
    };

    function subtype(a, b) { 
        return ((a.id === TDomain) && (b.id === TDomain)) ? (
            (a === b) ? a : (
                ((a === TNumber) && (b === TInteger)) ? a : (
                    ((a === TInteger) && (b === TNumber)) ? b : undefined
                )
            )
        ) : (
            (a.id === TDomain) ? (
                (a.basetype.id === b.id) ? a : (
                    ((a.basetype.id === TNumber) && (b.id === TInteger)) ? a : undefined
                )
            ) : (
                (b.id === TDomain) ? (
                    (b.basetype.id === a.id) ? b : (
                        ((b.basetype.id === TNumber) && (a.id === TInteger)) ? b : undefined
                    )
                ) : (
                    (a.id === b.id) ? a : (
                        ((a.id === TNumber) && (b.id === TInteger)) ? a : (
                            ((a.id === TInteger) && (b.id === TNumber)) ? b : undefined
                        )
                    )
                )
            )
        );
    }

    //--------------------------------------------------------------------
    // Expressions

    function Expression(name, id) {
        this.name = name;
        this.id = id;
    }

    function EEq() {}
    function ELt() {}
    function EGt() {}
    function ELe() {}
    function EGe() {}
    function ENe() {}

    function EAnd() {}
    function EOr() {}

    function EAdd() {}
    function ESub() {}
    function EMul() {}
    function EDiv() {}
    function EMod() {} 

    function ECount() {}
    function EAvg() {}

    function EIn() {}

    function ELiteral(type, literal) {
        this.type = type;
        this.value = literal;
    }

    function EAttribute(name, type, qualifiers, unique) {
        this.name = name;
        this.type = type;
        this.qualifiers = qualifiers;
        this.unique = unique;
    }

    EEq.prototype = freeze(new Expression('eq', EEq));
    ELt.prototype = freeze(new Expression('lt', ELt));
    EGt.prototype = freeze(new Expression('gt', EGt));
    ELe.prototype = freeze(new Expression('le', ELe));
    EGe.prototype = freeze(new Expression('ge', EGe));
    ENe.prototype = freeze(new Expression('ne', ENe));

    EAnd.prototype = freeze(new Expression('and', EAnd));
    EOr.prototype = freeze(new Expression('or', EOr));

    EAdd.prototype = freeze(new Expression('add', EAdd));
    ESub.prototype = freeze(new Expression('sub', ESub));
    EMul.prototype = freeze(new Expression('mul', EMul));
    EDiv.prototype = freeze(new Expression('div', EDiv));
    EMod.prototype = freeze(new Expression('mod', EMod));

    ECount.prototype = freeze(new Expression('count', ECount));
    EAvg.prototype = freeze(new Expression('avg', EAvg));

    EIn.prototype = freeze(new Expression('in', EIn));

    ELiteral.prototype = freeze(new Expression('literal', ELiteral));


    var ea_prototype = new Expression('attribute', EAttribute);
    
    ea_prototype.functionally_dependent_on = function(attr) {
        return (this === attr) || ((this.relation === attr.relation) && attr.unique);
    }

    EAttribute.prototype = freeze(ea_prototype);


    function wrap_literal(v) {
        switch (typeof(v)) {
            case 'number': return freeze(new ELiteral((parseInt(v) == v) ? this_rdm.integer : this_rdm.number, v));
            case 'string': return freeze(new ELiteral(this_rdm.string, "'" + v + "'"));
            case 'boolean': return freeze(new ELiteral(this_rdm.boolean, v));
            case 'object': switch (v.constructor) {
                case EnumValue: return freeze(new ELiteral(literal.domain.basetype, "'" + v + "'"));
                case Expression: return v;
                default: throw new TypeError("invalid expression '" + v + "'");
            }
            default: throw new TypeError("invalid expression '" + v + "'");
        }
    }

    function compare(l, rr, exp) {
        var r = wrap_literal(rr);
        if (subtype(l.type, r.type) === undefined) {
            throw new TypeError(
                "invalid expression '" + exp.name + "' arguments '"
                + l.type.name + "' and '" + r.type.name + "' not compatible"
            );
        }

        exp.type = this_rdm.boolean;
        exp.args = [l, r];
        return freeze(exp);
    }

    function logic(l, rr, exp) {
        var r = wrap_literal(rr),
            t = subtype(l.type, r.type);

        if ((t.id !== TBoolean) && ((t.id !== TDomain) || (t.basetype.id !== TBoolean))) {
            throw new TypeError(
                "invalid expression '" + exp.name + "' arguments '"
                + l.type.name + "' and '" + r.type.name + "' not compatible"
            );
        }

        exp.type = t;
        exp.args = [l, r];
        return freeze(exp);
    }

    function binop(l, rr, exp) {
        var r = wrap_literal(rr),
            t = subtype(l.type, r.type);

        if ((t.id !== TNumber) && (t.id !== TInteger) && ((t.id !== TDomain) || ((t.basetype.id !== TNumber) && (t.basetype.id !== TInteger)))) {
            throw new TypeError(
                "invalid expression '" + exp.name + "' arguments '"
                + l.type.name + "' and '" + r.type.name + "' not compatible"
            );
        }

        exp.type = t;
        exp.args = [l, r];
        return freeze(exp);
    }

    function relop(l, r, exp) {
        if (r.constructor !== Relation) {
            throw new TypeError('invalid relation in right argument');
        }

        if (r.attributes.length !== 1) {
            throw new TypeError('relation should have exactly one attribute');
        }

        if (subtype(l.type, r.attributes[0].type) === undefined) {
            throw new TypeError(
                "invalid expression '" + exp.name + "' arguments '"
                + l.type.name + "' and '" + r.attributes[0].type.name + "' not compatible"
            );
        }

        exp.type = this_rdm.boolean;
        exp.args = [l, r];
        return freeze(exp);
    }

    // TODO: restrict aggregate use to valid cases.

    function anyagg(l, exp) {
        exp.type = this_rdm.number;
        exp.aggregate = true;
        exp.args = [l];
        return freeze(exp);
    }

    function numagg(l, exp) {
        if (subtype(l.type, this_rdm.number) === undefined) {
            throw new TypeError('aggregate expression should be numeric');
        }

        exp.type = this_rdm.number;
        exp.aggregate = true;
        exp.args = [l];
        return freeze(exp);
    }

    // comparison operators

    Expression.prototype.eq = function(x) {
        return compare(this, x, new EEq);
    };

    Expression.prototype.lt = function(x) {
        return compare(this, x, new ELt);
    };

    Expression.prototype.gt = function(x) {
        return compare(this, x, new EGt);
    };

    Expression.prototype.le = function(x) {
        return compare(this, x, new ELe);
    };

    Expression.prototype.ge = function(x) {
        return compare(this, x, new EGe);
    };

    Expression.prototype.ne = function(x) {
        return compare(this, x, new ENe)
    };

    // logic operators

    Expression.prototype.and = function(x) {
        return logic(this, x, new EAnd);
    };

    Expression.prototype.or = function(x) {
        return logic(this, x, new EOr);
    };

    // numeric operators 

    Expression.prototype.add = function(x) {
        return binop(this, x, new EAdd);
    };

    Expression.prototype.sub = function(x) {
        return binop(this, x, new ESub);
    };

    Expression.prototype.mul = function(x) {
        return binop(this, x, new EMul);
    };

    Expression.prototype.div = function(x) {
        return binop(this, x, new EDiv);
    };

    Expression.prototype.mod = function(x) {
        return binop(this, x, new EMod);
    };

    // aggregate operators
    
    Expression.prototype.count = function(x) {
        return anyagg(this, new ECount);
    };

    Expression.prototype.avg = function(x) {
        return numagg(this, new EAvg);
    };

    // relaional operators

    Expression.prototype.in = function(x) {
        return relop(this, x, new EIn);
    };

    this.attribute = function(name, type, qualifiers) {
        if ((typeof(name) !== 'string') || (!name.match(name_regex))) {
            throw new TypeError('invalid name');
        }

        if (type.constructor !== Type) {
            throw new TypeError('invalid type');
        }

        if (qualifiers !== undefined && type.id === TDomain && type.qualifiers !== undefined) {
            if (qualifiers === undefined) {
                qualifiers = {};
            }

            for (var key in type.qualifiers) if (type.qualifiers.hasOwnProperty(key)) {
                if (qualifiers[key] === undefined) {
                    qualifiers[key] = type.qualifiers[key];
                }
            }
        }

        var unique = false;
        if ((qualifiers !== undefined) && qualifiers.auto_increment) {
            if ((type.id !== TInteger) && ((type.id !== TDomain) || (type.basetype.id !== TInteger))) {
                throw new TypeError('only integers can be auto_increment');
            }
            unique = true;
        }
                        
        return freeze(new EAttribute(name, type, qualifiers, unique));
    };

    //--------------------------------------------------------------------
    // Relations

    function Relation(name, id) {
        this.name = name;
        this.id = id;
    }

    function RTable(name, attributes, qualifiers) {
        this.name = name;
        this.qualifiers = qualifiers;

        this.sources = [name];
        this.attributes = attributes;
        this.restrictions = [];
        this.groups = [];
        this.orders = [];
    }

    function RDerived(relation) {
        this.sources = relation.sources;
        this.restrictions = relation.restrictions;
        this.attributes = relation.attributes;
        this.groups = relation.groups;
        this.orders = relation.orders;
    }

    RTable.prototype = freeze(new Relation('table', RTable));
    RDerived.prototype = freeze(new Relation('derived', RDerived));
    
    // check if all attributes used in an expression come from a relation
    function valid_expression(rel, exp) {
        if (exp.constructor === Expression) {
            if (exp.id === EAttribute) {
                for (var key in rel.attributes) if (rel.attributes.hasOwnProperty(key)) {
                    if (exp === rel.attributes[key]) {
                        return true;
                    }
                }
            } else if (exp.args !== undefined) {
                return exp.args.every(function(e) {
                    return valid_expression(rel, e);
                });
            } else {
                return true;
            }
        } else {
            return false;
        }
    }


    // TODO: make sure all expressions in a relation are aggregate or not aggregate when no grouping.


    // check if all attributes used in an expression come from a relation,
    // and that they are either aggregate or functionally dependent on the
    // grouping columns.
    function valid_aggregate_expression(relation, expression) {
        function valid(rel, exp, aggregate) {
            if (exp.constructor === Expression) {
                if (exp.id === EAttribute) {
                    for (var key in rel.attributes) if (rel.attributes.hasOwnProperty(key)) {
                        if (exp === rel.attributes[key]) {
                            return aggregate || rel.groups.some(function(group) {     
                                return exp.functionally_dependent_on(group);
                            });
                        }
                    }
                } else if (exp.args !== undefined) {
                    return exp.args.every(function(e) {
                        return valid(rel, e, aggregate || e.aggregate);
                    });
                } else {
                    return true;
                }
            } else {
                return false;
            }
        }

        return valid(relation, expression, relation.groups.length <= 0);
    }


            
    // TODO: implement better singleton test
    // (proves result must have exactly one row)
    function relation_singleton(rel) {
        return false; // ((rel.groups.length === 0) /*&&*/ );
    }

    // Lattice operators meet & join can replace the relational operators

    // Codd's six primitive operators (with natural join instead of cross-product)
    
    // project, extend, rename
    // TODO: validate projection arguments for grouping
    Relation.prototype.project = function(attributes) {
        var this_relation = this;

        for (var key in attributes) if (attributes.hasOwnProperty(key)) {
            if (!key.match(name_regex)) {
                throw new TypeError("invalid name '" + key + "' in projection");
            }

            var a = attributes[key],
                w = wrap_literal(a);

            if (!valid_aggregate_expression(this_relation, w)) {
                throw new TypeError('project argument ' + w.name + ' is not a valid expression');
            }

            if (w !== a) {
                attributes[key] = w;
            }
        }

        var r = new RDerived(this);
        r.attributes = attributes;
        return freeze(r);
    };

    Relation.prototype.restrict = function(exp) {
        if (!exp) {
            return this;
        }

        if (!valid_expression(this, exp)) {
            throw new TypeError('restrict argument is not a valid expression');
        }

        if ((exp.type.id !== TBoolean) && ((exp.type.id !== TDomain) || (exp.type.basetype.id !== TBoolean))) {
            throw new TypeError('restrict argument is not a boolean expression');
        }

        var r = new RDerived(this);
        r.restrictions = r.restrictions.concat([exp]);
        return freeze(r);
    };

    Relation.prototype.join = function(relation, exp) {
        if (relation.constructor !== Relation) {
            throw new TypeError('join argument is not a valid relation');
        }

        if ((exp.type.id !== TBoolean) && ((exp.type.id !== TDomain) || (exp.type.basetype.id !== TBoolean))) {
            throw new TypeError('join on argument is not a boolean expression');
        }

        var r = new RDerived(this);
        r.sources = r.sources.concat(relation.sources);
        for (var key in relation.attributes) if (relation.attributes.hasOwnProperty(key)) {
            if (r.attributes[key] === undefined) {
                r.attributes[key] = relation.attributes[key];
            } else {
                throw new TypeError('duplicate keys in relation');
            }
        }

        r.restrictions = r.restrictions.concat(relation.restrictions);
        r.restrictions.push(exp);

        if (!valid_expression(r, exp)) {
            throw new TypeError('join on argument is not a valid expression');
        }

        return freeze(r);
    };


    Relation.prototype.union = function() {};
    Relation.prototype.difference = function() {};

    // derived methods
    Relation.prototype.intersection = function() {};
    Relation.prototype.thetajoin = function() {};
    Relation.prototype.semijoin = function() {};
    Relation.prototype.antijoin = function() {};
    Relation.prototype.divide = function() {};
    Relation.prototype.leftjoin = function() {};
    Relation.prototype.rightjoin = function() {};
    Relation.prototype.fulljoin = function() {};

    // additional methods
    Relation.prototype.group = function(exp) {
        if (!valid_expression(this, exp)) {
            throw new TypeError('group argument is not a valid expression');
        }

        var r = new RDerived(this);
        r.groups.push(exp);
        //exp.attributes.forEach(function(a) {
        return freeze(r);
    };

    Relation.prototype.order = function(exp) {
        if (!valid_expression(this, exp)) {
            throw new TypeError('order argument is not a valid expression');
        }

        var r = new RDerived(this);
        r.orders.push(exp);
        return freeze(r);
    };

    this.relation = function(name, attributes, qualifiers) {
        if ((typeof(name) !== 'string') || (!name.match(name_regex))) {
            throw new TypeError('invalid name');
        }
        
        for (var a in attributes) if (attributes.hasOwnProperty(a)) {
            var attr = attributes[a];
            if (attr.constructor !== Expression && attr.id !== this_rdm.attribute) {
                throw new TypeError("'" + name + "'." + a + " invalid attribute");
            }
        }

        var r = new RTable(name, attributes, qualifiers);
        for (var a in r.attributes) if (r.attributes.hasOwnProperty(a)) {
            var t = r.attributes[a],
                n = new EAttribute(t.name, t.type, t.qualifiers, t.unique);

            n.relation = r;
            r.attributes[a] = freeze(n);
        }

        this.schema[name] = freeze(r);

        return freeze(r);
    };

    //--------------------------------------------------------------------
    // WebSQLite adapter.
    //
    // Note: This adapter will only work with SQLite as is. This is due to
    // the meta-data validation techniques differing between SQL
    // implementations. As all current WebSQL implementations use SQLite, 
    // this should not be a practical problem.

    this.WebSQLiteDataAdapter = function() {

        function expression_to_sql(exp, qualified) {
            switch(exp.id) {
            case EEq:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' = ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ELt:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' < ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EGt:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' > ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ELe:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' <= ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EGe:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' >= ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ENe:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' != ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EAnd:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' and ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EOr:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' or ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EAdd:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' + ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ESub:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' - ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EMul:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' * ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EDiv:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' / ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EMod:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' % ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ECount:
                return 'count(' + expression_to_sql(exp.args[0], qualified) + ')';
            case EAvg:
                return 'avg(' + expression_to_sql(exp.args[0], qualified) + ')';
            case EIn:
                return expression_to_sql(exp.args[0], qualified)
                    + ' in (' + relation_to_select(exp.args[1], qualified) + ')';
            case ELiteral:
                return exp.value;
            case EAttribute:
                return qualified ? exp.relation.sources[0] + '.' + exp.name : exp.name;
            default:
                throw new Error('unimplemented expression type');
            }
        }

        function attributes_to_columns(attributes, qualified, rename) {
            var sql = '';

            for (var key in attributes) if (attributes.hasOwnProperty(key)) {
                var a = attributes[key];
                sql += ((sql !== '') ? ', ' : '') + expression_to_sql(a, qualified)
                if (rename && ((a.id !== EAttribute) || (a.name !== key))) {
                    sql += ' as ' + key;
                }
            }

            return sql;
        }

        function restrictions_to_where(restrictions, qualified) {
            var sql = '';

            restrictions.forEach(function(restriction) {
                sql += ((sql !== '') ? ' and ' : '') + expression_to_sql(restriction, qualified);
            });

            return sql;
        }

        function groups_to_groupby(groups, qualified) {
            var sql = '';

            groups.forEach(function(group) {
                sql += ((sql !== '') ? ', ' : '') + expression_to_sql(group, qualified);
            });

            return sql;
        }

        function relation_to_select(relation, rename) {
            var qualified = (relation.sources.length > 1);
            return 'select ' + attributes_to_columns(relation.attributes, qualified, rename) 
                + ' from ' + relation.sources.join(', ')
                + ((relation.restrictions.length > 0)
                    ? ' where ' + restrictions_to_where(relation.restrictions, qualified)
                    : '')
                + ((relation.groups.length > 0)
                    ? ' group by ' + groups_to_groupby(relation.groups, qualified) 
                    : '');
        }

        function type_to_affinity(type) {
            switch(type.id) {
                case TInteger: return 'integer';
                case TNumber: return 'numeric';
                case TString: return 'text';
                case TBoolean: return 'integer';
                case TEnum: return 'text';
                case TDomain: switch(type.basetype.id) {
                    case TInteger: return 'integer';
                    case TNumber: return 'numeric';
                    case TString: return 'text';
                    case TBoolean: return 'integer';
                    case TEnum: return 'text';
                    default: throw new TypeError('unsupported attribute domain type');
                }
                default: throw new TypeError('unsupported attribute type');
            }
        }

        function relation_to_create(relation) {
            if (relation.id !== RTable) {
                throw new TypeError('relation is not createable');
            }

            var sql = '';
            for (var key in relation.attributes) if (relation.attributes.hasOwnProperty(key)) {
                var att = relation.attributes[key];
                if (sql !== '') {
                    sql += ', ';
                }
                sql += att.name + ' ' + type_to_affinity(att.type);
                var qal = att.qualifiers;
                if (qal !== undefined) {
                    if (qal.auto_increment === true) {
                        sql += ' primary key autoincrement';
                    } else if (qal.primary_key === true) {
                        sql += ' primary key';
                    }
                    if (qal.unique === true) {
                        sql += ' unique';
                    }
                    if (qal.not_null === true) {
                        sql += ' not null';
                    }
                    if (qal.default !== undefined) {
                        sql += ' default ' + att.qualifiers['default'];
                    }
                }
            }

            return 'create table ' + relation.sources[0] + ' (' + sql + ')';
        }

        function row_to_insert(relation, row) {
            var attrs = [],
                values = [];

            for (var key in row) if (row.hasOwnProperty(key)) {
                if (relation.attributes[key] === undefined) {
                    throw new TypeError("invalid attribute '" + key + "' for relation '" + relation.name + "'");
                }

                var value = wrap_literal(row[key]);
                if (!valid_expression(relation, value)) {
                    throw new TypeError('invalid expression');
                }

                attrs.push(key);
                values.push(expression_to_sql(value));
            }

            return 'insert into ' + relation.sources[0] + ' (' + attrs.join() + ') values (' + values.join() + ')';
        }

        function row_to_update(relation, row, exp) {
            var set = [];

            for (var key in row) if (row.hasOwnProperty(key)) {
                if (relation.attributes[key] === undefined) {
                    throw new TypeError("invalid attribute '" + key + "' for relation '" + relation.name + "'");
                }

                var value = wrap_literal(row[key]);
                if (!valid_expression(relation, value)) {
                    throw new TypeError('invalid expression');
                }

                set.push(key + ' = ' + expression_to_sql(value));
            }

            var sql = 'update ' + relation.sources[0] + ' set ' + set.join();
            if (exp !== undefined) {
                if (!valid_expression(relation, exp)) {
                    throw new TypeError('invalid expression');
                }

                sql += ' where ' + expression_to_sql(exp);
            }

            return sql;
        }

        function relation_to_remove(relation, exp) {
            var sql = 'delete from ' + relation.sources[0];
            if (exp !== undefined) {
                sql += ' where ' + expression_to_sql(exp);
            }
            return sql;
        }

        function validate_table(tx, relation) {
            tx.executeSql("select sql from sqlite_master where type='table' and name=?", [relation.name],
                function(tx, results) {
                    var sql = relation_to_create(relation);
                    //alert(sql);
                    if (results.rows.length === 1) {
                        if (sql !== results.rows.item(0).sql.toLowerCase()) {
                            throw new TypeError("relation '" + relation.name + "'validation failed");
                        }
                    } else {
                        tx.executeSql(sql, []);
                    }
                }
            );
        }

        function Validate() {}

        function ValidDb(db) {
            this.db = db;
        }

        this_sql = this;

        this.validate = function(name, version, drop) {
            var validate = new Validate,
                db = openDatabase(name, version, "relaional data model v1.0", 4096);

            db.transaction(
                function(tx) {
                    for (var r in this_rdm.schema) if (this_rdm.schema.hasOwnProperty(r)) {
                        if (drop) {
                            tx.executeSql('drop table if exists ' + this_rdm.schema[r].sources[0]);
                        }
                        validate_table(tx, this_rdm.schema[r]);
                    }
                },
                function(error) {
                    if (validate.onerror !== undefined) {
                        validate.onerror(error);
                    } 
                },
                function() {
                    validate.onsuccess(freeze(new ValidDb(db)));
                }
            );
            return validate;
        };

        function Transaction() {}

        ValidDb.prototype.transaction = function(transfn) {
            var transaction = new Transaction;
            this.db.transaction(
                function(tx) {
                    transaction.tx = tx;
                    try {
                        transfn(transaction);
                    } catch(e) {
                        transaction.error = e;
                        alert(e.stack);
                        throw e;
                    }
                },
                function(error) {
                    if (transaction.error !== undefined) {
                        error.message = error.message + ' ['
                            + transaction.error.name + ': '
                            + transaction.error.message + ']';
                        error.stack = transaction.error.stack;
                    }

                    if (transaction.onerror !== undefined) {
                        transaction.onerror(error);
                    } else {
                        throw error;
                    }
                },
                function() {
                    if (transaction.onsuccess !== undefined) {
                        transaction.onsuccess();
                    }
                }
            );
            return transaction;
        };

        function Query() {}
        
        function Result(result) {
            var rows = result.rows;

            this.forEach = function(f) {
                try {
                    var i = 0,
                        row = rows.item(0);
                    while (row !== null) {
                        f(row);
                        i += 1;
                        row = rows.item(i);
                    }
                } catch(e) {
                    if (e.name !== 'RangeError') {
                        throw e;
                    }
                }
            }
        }

        Transaction.prototype.query = function(relation) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }
            
            var this_transaction = this,
                query = new Query,
                s = relation_to_select(relation, true);

            alert(s);
            this.tx.executeSql(s, [],
                function(t, r) {
                    if (query.onsuccess !== undefined) {
                        try {
                            if (relation_singleton(relation)) {
                                query.onsuccess(r.rows.item(0));
                            } else {
                                query.onsuccess(new Result(r));
                            }
                        } catch(e) {
                            this_transaction.error = e;
                            throw e;
                        }
                    }
                },
                function(t, e) {
                    if (query.onerror !== undefined) {
                        try {
                            query.onerror(e);
                            return false;
                        } catch(e) {
                            this_transaction.error = e;
                            throw e;
                        }
                    } else {
                        this_transaction.error = e;
                        return true;
                    }
                }
            );
            return query;
        };

        function Insert() {}

        Transaction.prototype.insert = function(relation, row) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }

            if (relation.id !== RTable) {
                throw new TypeError('relation is not insertable');
            }

            var this_transaction = this,
                insert = new Insert,
                s = row_to_insert(relation, row);

            //alert(s);
            this.tx.executeSql(s, [],
                function(t, r) {
                    if (insert.onsuccess !== undefined) {
                        try {
                            insert.onsuccess(r.insertId);
                        } catch(e) {
                            this_transaction.error = e;
                            throw e;
                        }
                    }
                },
                function(t, e) {
                    if (insert.onerror !== undefined) {
                        try {
                            insert.onerror(e);
                            return false;
                        } catch(e) {
                            this_transaction.error = e;
                            throw e;
                        }
                    } else {
                        this_transaction.error = e;
                        return true;
                    }
                }
            );
            return insert;
        };

        Transaction.prototype.update = function(relation, row, exp, success) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }

            if (relation.id !== RTable) {
                throw new TypeError('relation is not updateable');
            }
            
            var s = row_to_update(relation, row, exp);
            alert(s);
            this.tx.executeSql(s, [], function(tx, result) {
                if (success !== undefined) {
                    success(result.rowsAffected);
                }
            });
        };

        function Remove() {}

        Transaction.prototype.remove  = function(relation, exp) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }

            if (relation.id !== RTable) {
                throw new TypeError('relation is not updateable');
            }

            var this_transaction = this,
                remove = new Remove,
                s = relation_to_remove(relation, exp);

            alert(s);
            this.tx.executeSql(s, [], 
                function(t, r) {
                    if (remove.onsuccess !== undefined) {
                        try {
                            remove.onsuccess(r.rowsAffected);
                        } catch(e) {
                            this_transaction.error = e;
                            throw e;
                        }
                    }
                },
                function(t, e) {
                    if (remove.onerror !== undefined) {
                        try {
                            remove.onerror(e);
                            return false;
                        } catch(e) {
                            this_transaction.error = e;
                            throw e;
                        }
                    } else {
                        this_transaction.error = e;
                        return true;
                    }
                }
            );
            return remove;
        }
    };

    //--------------------------------------------------------------------
    // PostgreSQL adapter.
    //

    this.PostgreSQLDataAdapter = function() {

        // SQL code generator

        function expression_to_sql(exp, qualified) {
            switch(exp.id) {
            case EEq:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' = ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ELt:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' < ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EGt:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' > ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ELe:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' <= ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EGe:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' >= ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ENe:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' != ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EAnd:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' and ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EOr:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' or ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EAdd:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' + ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ESub:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' - ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EMul:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' * ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EDiv:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' / ' + expression_to_sql(exp.args[1], qualified) + ')';
            case EMod:
                return '(' + expression_to_sql(exp.args[0], qualified)
                    + ' % ' + expression_to_sql(exp.args[1], qualified) + ')';
            case ECount:
                return 'count(' + expression_to_sql(exp.args[0], qualified) + ')';
            case EAvg:
                return 'avg(' + expression_to_sql(exp.args[0], qualified) + ')';
            case EIn:
                return expression_to_sql(exp.args[0], qualified)
                    + ' in (' + relation_to_select(exp.args[1], qualified) + ')';
            case ELiteral:
                return exp.value;
            case EAttribute:
                return qualified ? exp.relation.sources[0] + '.' + exp.name : exp.name;
            default:
                throw new Error('unimplemented expression type');
            }
        }

        function attributes_to_columns(attributes, qualified, rename) {
            var sql = '';

            for (var key in attributes) if (attributes.hasOwnProperty(key)) {
                var a = attributes[key];
                sql += ((sql !== '') ? ', ' : '') + expression_to_sql(a, qualified)
                if (rename && ((a.id !== EAttribute) || (a.name !== key))) {
                    sql += ' as ' + key;
                }
            }

            return sql;
        }

        function restrictions_to_where(restrictions, qualified) {
            var sql = '';

            restrictions.forEach(function(restriction) {
                sql += ((sql !== '') ? ' and ' : '') + expression_to_sql(restriction, qualified);
            });

            return sql;
        }

        function groups_to_groupby(groups, qualified) {
            var sql = '';

            groups.forEach(function(group) {
                sql += ((sql !== '') ? ', ' : '') + expression_to_sql(group, qualified);
            });

            return sql;
        }

        function relation_to_select(relation, rename) {
            var qualified = (relation.sources.length > 1);
            return 'select ' + attributes_to_columns(relation.attributes, qualified, rename) 
                + ' from ' + relation.sources.join(', ')
                + ((relation.restrictions.length > 0)
                    ? ' where ' + restrictions_to_where(relation.restrictions, qualified)
                    : '')
                + ((relation.groups.length > 0)
                    ? ' group by ' + groups_to_groupby(relation.groups, qualified) 
                    : '');
        }

        function type_to_affinity(type) {
            switch(type.id) {
                case TInteger: return 'integer';
                case TNumber: return 'numeric';
                case TString: return 'text';
                case TBoolean: return 'integer';
                case TEnum: return 'text';
                case TDomain: switch(type.basetype.id) {
                    case TInteger: return 'integer';
                    case TNumber: return 'numeric';
                    case TString: return 'text';
                    case TBoolean: return 'integer';
                    case TEnum: return 'text';
                    default: throw new TypeError('unsupported attribute domain type');
                }
                default: throw new TypeError('unsupported attribute type');
            }
        }

        function create_table(client, relation) {
            if (relation.id !== RTable) {
                throw new TypeError('relation is not createable');
            }

            var sql = 'create table ' + relation.sources[0] + ' (';
            var first = true;
            for (var key in relation.attributes) if (relation.attributes.hasOwnProperty(key)) {
                var att = relation.attributes[key];
                if (first) {
                    first = false;
                } else {
                    sql += ', ';
                }
                sql += att.name + ' ';
                var typ = type_to_affinity(att.type),
                    qal = att.qualifiers;
                if (qal !== undefined) {
                    if (qal.auto_increment === true && typ === 'integer') {
                        sql += 'serial';
                    } else {
                        sql += typ;
                    }
                    if (qal.primary_key === true) {
                        sql += ' primary key';
                    }
                    if (qal.unique === true) {
                        sql += ' unique';
                    }
                    if (qal.not_null === true) {
                        sql += ' not null';
                    }
                    if (qal.default !== undefined) {
                        sql += ' default ' + att.qualifiers['default'];
                    }
                }
            }

            console.log('[' + sql + ')]');
            client.query(sql + ')');
        }

        function merge_keys(objs) {
            var keys = {};
            var attrs = [];
            for (var i = objs.length; i--;) for (var k in objs[i]) if (objs[i].hasOwnProperty(k) && !keys[k]) {
                console.log(k);
                attrs.push(k);
                keys[k] = true;
            }
            return attrs;
        }

        function row_to_insert(relation, rows) {
            if (!(rows.constructor === Array)) rows = [rows];
            var attrs = merge_keys(rows),
                values = [];

            for (var i = rows.length; i--;) {
                values[i] = [];
                for (var j = attrs.length; j--;) {
                    if (relation.attributes[attrs[j]] === undefined) {
                        throw new TypeError("invalid attribute '" + attrs[j] + "' for relation '" + relation.name + "'");
                    }

                    var value = wrap_literal(rows[i][attrs[j]]);
                    if (!valid_expression(relation, value)) {
                        throw new TypeError('invalid expression');
                    }

                    values[i].push(expression_to_sql(value));
                }
                values[i] = values[i].join();
            }


            return 'insert into ' + relation.sources[0] + ' (' + attrs.join() + ') values (' + values.join('), (') + ') returning *';
        }

        function row_to_update(relation, row, exp) {
            var set = [];

            for (var key in row) if (row.hasOwnProperty(key)) {
                if (relation.attributes[key] === undefined) {
                    throw new TypeError("invalid attribute '" + key + "' for relation '" + relation.name + "'");
                }

                var value = wrap_literal(row[key]);
                if (!valid_expression(relation, value)) {
                    throw new TypeError('invalid expression');
                }

                set.push(key + ' = ' + expression_to_sql(value));
            }

            var sql = 'update ' + relation.sources[0] + ' set ' + set.join();
            if (exp !== undefined) {
                if (!valid_expression(relation, exp)) {
                    throw new TypeError('invalid expression');
                }

                sql += ' where ' + expression_to_sql(exp);
            }

            return sql;
        }

        function relation_to_remove(relation, exp) {
            var sql = 'delete from ' + relation.sources[0];
            if (exp !== undefined) {
                sql += ' where ' + expression_to_sql(exp);
            }
            return sql;
        }

        function validate_table(client, relation) {
            client.query("select column_name from information_schema.columns where table_name=$1", [relation.name],
                function(err, results) {
                    if (results.rows.length === 0) {
                        create_table(client, relation);
                    }
                }
            );
        }

        // node-postgres driver
        var pg = require('pg');

        var pg_begin = function(client, f) {
            console.log('[transaction begin]');
            //client.pauseDrain();
            client.query('begin', f);
        };

        var pg_commit = function(client, f) {
            client.query('commit', function(err, result) {
                console.log('[transaction commit]');
                //client.resumeDrain();
                if (f !== undefined) {
                    f(err, result);
                }
            });
        }; 

        var pg_rollback = function(client, f) {
            client.query('rollback', function(err, result) {
                console.log('[transaction rollback]');
                //client.resumeDrain();
                if (f !== undefined) {
                    f(err, result);
                }
            });
        };

        var pg_sleep = function(client, s, f) {
            client.query('select pg_sleep(' + s + ')', f);
        };

        var EventEmitter = require('events').EventEmitter;
        var util = require('util');

        function Validate() {
            EventEmitter.call(this);
        }
        util.inherits(Validate, EventEmitter);

        function ValidDb(db) {
            this.db = db;
        }

        this_sql = this;

        this.validate = function(name, version, drop) {
            var validate = new Validate;

            pg.connect(name, function(err, client) {
                if (err) {
                    validate.emit('error', err);
                } else {
                    client.on('error', function(e) {
                        validate.emit('error', e);
                    }).once('drain', function() {
                        console.log('[validate ready]');
                        validate.emit('ready', new ValidDb(name));
                    });
                    console.log('[validate begin]');
                    for (var r in this_rdm.schema) if (this_rdm.schema.hasOwnProperty(r)) {
                        if (drop) {
                            client.query('drop table if exists ' + this_rdm.schema[r].sources[0]);
                        }
                        validate_table(client, this_rdm.schema[r]);
                    };
                }
            });
            return validate;
        };

        function Connection() {
            EventEmitter.call(this);
        }
        util.inherits(Connection, EventEmitter);

        ValidDb.prototype.connect = function() {
            var connect = new Connection,
                db = this.db;
            process.nextTick(function() {
                pg.connect(db, function(err, client) {
                    if (err) {
                        connect.emit('error', err);
                    } else {
                        connect.db = client;
                        connect.emit('ready', connect);
                    }
                });
            });
            return connect;
        };

        function Transaction() {
            EventEmitter.call(this);
        }
        util.inherits(Transaction, EventEmitter);

        Connection.prototype.transaction = function(transfn) {
            var transaction = new Transaction,
                db = this.db;

            db.query('begin').on('error', function(e) {
                transaction.emit('error', e);
            }).on('end', function() {
                db.once('drain', function() {
                    console.log('[transaction end]');
                    db.query('commit').on('error', function(e) {
                        transaction.emit('error', e);
                    }).on('end', function() {
                        transaction.emit('end');
                    });
                });
                console.log('[transaction begin]');
                transaction.tx = db;
                transfn(transaction);
            });
            return transaction;
        };

        function Query() {
            EventEmitter.call(this);
        }
        util.inherits(Query, EventEmitter);
        
        Transaction.prototype.query = function(relation) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }
            
            var this_transaction = this,
                query = new Query,
                s = relation_to_select(relation, true);

            console.log('[' + s + ']');

            this.tx.query(s).on('error', function(e) {
                if (query.listeners('error').length > 0) {
                    query.emit('error', e);
                } else {
                    this_transaction.emit('error', e);
                }
            }).on('row', function(r) {
                query.emit('row', r);
            }).on('end', function() {
                query.emit('end');
            });

            return query;
        };

        function Insert() {
            EventEmitter.call(this);
        }
        util.inherits(Insert, EventEmitter);

        Transaction.prototype.insert = function(relation, row) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }

            if (relation.id !== RTable) {
                throw new TypeError('relation is not insertable');
            }

            var this_transaction = this,
                insert = new Insert,
                s = row_to_insert(relation, row);

            console.log('[' + s + ']');
            
            this.tx.query(s).on('error', function(e) {
                if (insert.listeners('error').length > 0) {
                    insert.emit('error',e);
                } else {
                    this_transaction.emit('error', e);
                }
            }).on('row', function(r) {
                insert.emit('row', r);
            }).on('end', function() {
                insert.emit('end');
            });

            return insert;
        };

        function Update() {
            EventEmitter.call(this);
        }
        util.inherits(Update, EventEmitter);

        Transaction.prototype.update = function(relation, row, exp) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }

            if (relation.id !== RTable) {
                throw new TypeError('relation is not updateable');
            }
            
            var this_transaction = this,
                update = new Update,
                s = row_to_update(relation, row, exp);

            console.log('[' + s + ']');

            this.tx.query(s).on('error', function(e) {
                if (update.listeners('error').length > 0) {
                    update.emit('error',e);
                } else {
                    this_transaction.emit('error', e);
                }
            }).on('row', function(r) {
                update.emit('row', r);
            }).on('end', function() {
                update.emit('end');
            });

            return update;
        };

        function Remove() {
            EventEmitter.call(this);
        }
        util.inherits(Remove, EventEmitter);

        Transaction.prototype.remove  = function(relation, exp) {
            if (relation.constructor !== Relation) {
                throw new TypeError('invalid relation');
            }

            if (relation.id !== RTable) {
                throw new TypeError('relation is not updateable');
            }

            var this_transaction = this,
                remove = new Remove,
                s = relation_to_remove(relation, exp);

            console.log('[' + s + ']');
        
            this.tx.query(s).on('error', function(e) {
                if (remove.listeners('error').length > 0) {
                    remove.emit('error', e);
                } else {
                    this_transaction.emit('error', e);
                }
            }).on('row', function(r) {
                remove.emit('row', r);
            }).on('end', function() {
                remove.emit('end');
            });
                
            return remove;
        }
    };
}

exports.RelationalDataModel = RelationalDataModel;
